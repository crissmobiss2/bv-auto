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

    // Async payment methods can complete checkout while still unpaid. Only
    // record money that Stripe has actually captured.
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, pending: true });
    }

    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return NextResponse.json({ received: true });

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    // Stripe retries webhooks. The payment intent (or session id) is the
    // idempotency key; a duplicate delivery must not create a second payment.
    const externalRef = paymentIntent || session.id;
    const amountPaid = Math.round(((session.amount_total || 0) / 100) * 100) / 100;
    if (amountPaid <= 0) return NextResponse.json({ received: true });

    const existingPayment = await prisma.payment.findFirst({
      where: { invoiceId, reference: externalRef, notes: "Stripe online payment" },
      select: { id: true },
    });
    if (existingPayment) return NextResponse.json({ received: true, duplicate: true });

    let result: {
      invoice: { invoiceNumber: string; customer: { firstName: string; lastName: string; email: string | null; phone: string } };
      amountPaid: number;
    } | null = null;

    try {
      result = await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction to close the duplicate-delivery race.
        const duplicate = await tx.payment.findFirst({
          where: { invoiceId, reference: externalRef, notes: "Stripe online payment" },
          select: { id: true },
        });
        if (duplicate) return null;

        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: { customer: true },
        });
        if (!invoice) return null;
        if (invoice.status === "VOID" || invoice.status === "REFUNDED") return null;
        if (Number(invoice.amountDue) <= 0) return null;

        const payment = await tx.payment.create({
          data: {
            invoiceId,
            amount: amountPaid,
            method: "CREDIT_CARD",
            reference: externalRef,
            notes: "Stripe online payment",
          },
        });

        const payments = await tx.payment.findMany({
          where: { invoiceId },
          select: { amount: true },
        });
        const totalPaid = Math.round(
          payments.reduce((sum, p) => sum + Number(p.amount), 0) * 100,
        ) / 100;
        const amountDue = Math.max(
          0,
          Math.round((Number(invoice.totalAmount) - totalPaid) * 100) / 100,
        );
        const newStatus = amountDue <= 0 ? "PAID" : "PARTIAL";

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: totalPaid,
            amountDue,
            status: newStatus,
            paidAt: newStatus === "PAID" ? new Date() : undefined,
          },
        });

        if (newStatus === "PAID") {
          await tx.job.update({ where: { id: invoice.jobId }, data: { status: "PAID" } });
        }

        return { invoice, amountPaid: Number(payment.amount) };
      }, { isolationLevel: "Serializable" });
    } catch (e) {
      // A serialization conflict means another delivery won the race.
      const code = (e as { code?: string })?.code;
      if (code === "P2034") return NextResponse.json({ received: true, duplicate: true });
      console.error("Stripe payment recording failed:", e);
      return NextResponse.json({ error: "Payment recording failed" }, { status: 500 });
    }

    if (!result) return NextResponse.json({ received: true });

    const amountStr = formatCurrency(result.amountPaid);
    const customerName = `${result.invoice.customer.firstName} ${result.invoice.customer.lastName}`;

    if (result.invoice.customer.email) {
      sendPaymentReceiptEmail({
        to: result.invoice.customer.email,
        customerName,
        invoiceNumber: result.invoice.invoiceNumber,
        amountPaid: amountStr,
        method: "Credit Card (Stripe)",
      }).catch(console.error);
    }

    if (result.invoice.customer.phone) {
      sendPaymentReceivedSMS({
        to: result.invoice.customer.phone,
        customerName: result.invoice.customer.firstName,
        amountPaid: amountStr,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ received: true });
}
