import { NextRequest } from "next/server";
import { z } from "zod";
import { AuditAction, PaymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, logAudit, requireRole } from "@/lib/api-helpers";
import { stripe } from "@/lib/stripe";
import { isUniqueViolation, lockInvoice, reconcileInvoice, roundMoney } from "@/lib/payments";

const refundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

class RefundTooLargeError extends Error {}

async function refundableAmount(paymentId: string, client: Pick<typeof prisma, "payment"> = prisma) {
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
    include: { refunds: { select: { amount: true } } },
  });
  if (!payment) return { payment: null, refundable: 0 };
  const refunded = payment.refunds.reduce((s, r) => s + Number(r.amount), 0); // negative
  return { payment, refundable: roundMoney(Number(payment.amount) + refunded) };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;
  const { id } = await params;

  const parsed = refundSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);
  const { paymentId, reason, idempotencyKey } = parsed.data;
  const amount = roundMoney(parsed.data.amount);

  const replay = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (replay) return apiSuccess({ refund: replay, duplicate: true });

  const { payment, refundable } = await refundableAmount(paymentId);
  if (!payment || payment.invoiceId !== id) return apiError("Payment not found on this invoice", 404);
  if (payment.type === PaymentType.REFUND) return apiError("A refund cannot be refunded", 400);
  if (amount > refundable + 0.005) {
    return apiError(`Refund exceeds the refundable amount ($${refundable.toFixed(2)})`, 400);
  }

  // Card payments are refunded through Stripe first; the ledger row records
  // the Stripe refund id so the charge.refunded webhook cannot add it twice.
  let externalId: string | undefined;
  const paymentIntent = payment.externalId?.startsWith("pi_")
    ? payment.externalId
    : payment.reference?.startsWith("pi_") ? payment.reference : null;
  if (paymentIntent) {
    if (!stripe) return apiError("Stripe is not configured; card refunds cannot be issued", 503);
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntent, amount: Math.round(amount * 100), metadata: { invoiceId: id, paymentId } },
        { idempotencyKey: `refund-${idempotencyKey}` },
      );
      externalId = refund.id;
    } catch (e) {
      return apiError(e instanceof Error ? e.message : "Stripe refund failed", 502);
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, id);
      const { refundable: stillRefundable } = await refundableAmount(paymentId, tx);
      if (amount > stillRefundable + 0.005) throw new RefundTooLargeError();
      const refund = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: -amount,
          type: PaymentType.REFUND,
          method: payment.method,
          refundOfId: payment.id,
          externalId,
          idempotencyKey,
          notes: reason ? `Refund: ${reason}` : "Refund",
          createdById: session!.user.id,
        },
      });
      const reconciled = await reconcileInvoice(tx, id);
      return { refund, invoice: reconciled.invoice };
    });

    await logAudit(session!.user.id, AuditAction.PAYMENT, "Invoice", id, null, {
      refundId: result.refund.id,
      refundOf: payment.id,
      amount: -amount,
      stripeRefund: externalId ?? null,
    });
    return apiSuccess(result);
  } catch (e) {
    if (e instanceof RefundTooLargeError) {
      return apiError("The refundable amount changed. Refresh and try again.", 409);
    }
    if (isUniqueViolation(e)) {
      const existing = await prisma.payment.findFirst({
        where: { OR: [{ idempotencyKey }, ...(externalId ? [{ externalId }] : [])] },
      });
      if (existing) return apiSuccess({ refund: existing, duplicate: true });
    }
    throw e;
  }
}
