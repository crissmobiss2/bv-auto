import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { sendPaymentReceivedSMS } from "@/lib/sms";
import { formatCurrency } from "@/lib/utils";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return NextResponse.json({ received: true });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) return NextResponse.json({ received: true });

    const amountPaid = (session.amount_total || 0) / 100;

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId,
          amount: amountPaid,
          method: "CREDIT_CARD",
          reference: session.payment_intent as string || undefined,
          notes: "Stripe online payment",
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: { increment: amountPaid },
          amountDue: { decrement: amountPaid },
          status: "PAID",
          paidAt: new Date(),
        },
      }),
    ]);

    const amountStr = formatCurrency(amountPaid);
    const customerName = `${invoice.customer.firstName} ${invoice.customer.lastName}`;

    if (invoice.customer.email) {
      sendPaymentReceiptEmail({
        to: invoice.customer.email,
        customerName,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: amountStr,
        method: "Credit Card (Stripe)",
      }).catch(console.error);
    }

    if (invoice.customer.phone) {
      sendPaymentReceivedSMS({
        to: invoice.customer.phone,
        customerName: invoice.customer.firstName,
        amountPaid: amountStr,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ received: true });
}
