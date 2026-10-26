import { NextRequest, NextResponse } from "next/server";
import { enterShop } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { sendPaymentReceivedSMS } from "@/lib/sms";
import { formatCurrency } from "@/lib/utils";
import { isUniqueViolation, lockInvoice, reconcileInvoice, roundMoney } from "@/lib/payments";

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

  if (event.type === "charge.refunded") {
    return handleChargeRefunded(event.data.object);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Async payment methods can complete checkout while still unpaid. Only
    // record money that Stripe has actually captured.
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, pending: true });
    }

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    // Stripe retries webhooks. The PaymentIntent (or session id) is stored in
    // the unique Payment.externalId, so a duplicate delivery cannot double-record.
    const externalRef = paymentIntent || session.id;
    const amountPaid = roundMoney((session.amount_total || 0) / 100);
    if (amountPaid <= 0) return NextResponse.json({ received: true });

    if (session.metadata?.type === "deposit" && session.metadata?.quoteId) {
      return handleDeposit(session.metadata.quoteId, externalRef, amountPaid);
    }

    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return NextResponse.json({ received: true });

    const existingPayment = await prisma.payment.findFirst({
      where: {
        OR: [
          { externalId: externalRef },
          { invoiceId, reference: externalRef, notes: "Stripe online payment" },
        ],
      },
      select: { id: true },
    });
    if (existingPayment) return NextResponse.json({ received: true, duplicate: true });

    let result: {
      invoice: { shopId: string | null; invoiceNumber: string; customer: { firstName: string; lastName: string; email: string | null; phone: string } };
      amountPaid: number;
    } | null = null;

    try {
      result = await prisma.$transaction(async (tx) => {
        await lockInvoice(tx, invoiceId);
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
            externalId: externalRef,
            notes: "Stripe online payment",
          },
        });
        await reconcileInvoice(tx, invoiceId);
        return { invoice, amountPaid: Number(payment.amount) };
      });
    } catch (e) {
      // Unique externalId: another delivery of this event already recorded it.
      if (isUniqueViolation(e)) return NextResponse.json({ received: true, duplicate: true });
      console.error("Stripe payment recording failed:", e);
      return NextResponse.json({ error: "Payment recording failed" }, { status: 500 });
    }

    if (!result) return NextResponse.json({ received: true });
    if (result.invoice.shopId) enterShop(result.invoice.shopId);

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

// A quote deposit is held on the quote until the invoice exists; if the
// invoice already exists it is applied there as a DEPOSIT payment.
async function handleDeposit(quoteId: string, externalRef: string, amount: number) {
  try {
    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        select: { id: true, jobId: true, depositExternalId: true, job: { select: { invoice: { select: { id: true } } } } },
      });
      if (!quote || quote.depositExternalId === externalRef) return;
      await tx.quote.update({
        where: { id: quoteId },
        data: { depositPaid: { increment: amount }, depositExternalId: externalRef, depositPaidAt: new Date() },
      });
      const invoiceId = quote.job.invoice?.id;
      if (invoiceId) {
        await lockInvoice(tx, invoiceId);
        await tx.payment.create({
          data: {
            invoiceId,
            amount,
            type: "DEPOSIT",
            method: "CREDIT_CARD",
            reference: externalRef,
            externalId: externalRef,
            notes: "Stripe deposit",
          },
        });
        await reconcileInvoice(tx, invoiceId);
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ received: true, duplicate: true });
    console.error("Stripe deposit recording failed:", e);
    return NextResponse.json({ error: "Deposit recording failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

// Refunds issued from the Stripe dashboard (or by our refund route) arrive here.
// The ledger is brought up to Stripe's cumulative refunded amount, so the
// event is idempotent whether or not our route already recorded the refund.
async function handleChargeRefunded(charge: { id: string; amount: number; amount_refunded: number; payment_intent: string | { id: string } | null }) {
  const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return NextResponse.json({ received: true });

  const original = await prisma.payment.findFirst({
    where: { OR: [{ externalId: paymentIntent }, { reference: paymentIntent }], type: { not: "REFUND" } },
    include: { refunds: { select: { amount: true } } },
  });
  if (!original) {
    // Deposit refunded before the quote became an invoice: shrink the credit
    // so invoice creation does not apply money that was returned.
    const quote = await prisma.quote.findUnique({ where: { depositExternalId: paymentIntent }, select: { id: true } });
    if (quote) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { depositPaid: Math.max(0, roundMoney((charge.amount - charge.amount_refunded) / 100)) },
      });
      return NextResponse.json({ received: true, depositAdjusted: true });
    }
    return NextResponse.json({ received: true, unmatched: true });
  }

  const stripeRefunded = roundMoney(charge.amount_refunded / 100);
  const recorded = roundMoney(-original.refunds.reduce((s, r) => s + Number(r.amount), 0));
  const missing = roundMoney(stripeRefunded - recorded);
  if (missing <= 0) return NextResponse.json({ received: true, duplicate: true });

  try {
    await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, original.invoiceId);
      await tx.payment.create({
        data: {
          invoiceId: original.invoiceId,
          amount: -missing,
          type: "REFUND",
          method: original.method,
          refundOfId: original.id,
          externalId: `charge-refund:${charge.id}:${charge.amount_refunded}`,
          notes: "Stripe refund",
        },
      });
      await reconcileInvoice(tx, original.invoiceId);
    });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ received: true, duplicate: true });
    console.error("Stripe refund recording failed:", e);
    return NextResponse.json({ error: "Refund recording failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
