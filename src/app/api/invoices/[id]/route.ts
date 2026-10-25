import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, InvoiceStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { sendPushToRole } from "@/lib/push";
import { formatCurrency } from "@/lib/utils";
import { isUniqueViolation, lockInvoice, reconcileInvoice } from "@/lib/payments";

const paymentSchema = z.object({
  action: z.literal("payment"),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
  receivedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid receivedAt").optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
});

const updateInvoiceSchema = z.object({
  notes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid dueDate").nullable().optional(),
  status: z.literal("VOID").optional(),
  voidReason: z.string().optional(),
}).partial();

class OverpaymentError extends Error {
  constructor() {
    super("PAYMENT_EXCEEDS_BALANCE");
    this.name = "OverpaymentError";
  }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      job: { include: { vehicle: true, technician: { select: { id: true, name: true } } } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { receivedAt: "desc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!invoice) return apiError("Invoice not found", 404);
  return apiSuccess(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!existing) return apiError("Invoice not found", 404);

  // Handle payment recording
  if (body.action === "payment") {
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0].message);
    if (existing.status === "VOID" || existing.status === "REFUNDED") {
      return apiError("Cannot record a payment on a void or refunded invoice", 400);
    }

    const key = parsed.data.idempotencyKey;
    if (key) {
      const replay = await prisma.payment.findUnique({ where: { idempotencyKey: key } });
      if (replay) {
        const invoice = await prisma.invoice.findUnique({ where: { id } });
        return apiSuccess({ invoice, payment: replay, duplicate: true });
      }
    }

    const balance = Number(existing.amountDue);
    if (parsed.data.amount > balance + 0.005) {
      return apiError(`Payment exceeds the balance due (${formatCurrency(balance)})`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockInvoice(tx, id);
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: parsed.data.amount,
          method: parsed.data.method,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
          idempotencyKey: key,
          createdById: session!.user.id,
          receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date(),
        },
      });

      // Totals are recomputed from every payment row under the row lock, so
      // two concurrent desk payments cannot both use a stale balance.
      const paidSoFar = await tx.payment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } });
      if (Number(paidSoFar._sum.amount ?? 0) > Number(existing.totalAmount) + 0.005) {
        // Rolls back the inserted payment; never leave an overpaid invoice.
        throw new OverpaymentError();
      }
      const reconciled = await reconcileInvoice(tx, id);
      return { payment, updated: reconciled.invoice, newStatus: reconciled.status };
    }, { isolationLevel: "Serializable" }).catch(async (error: unknown) => {
      if (error instanceof OverpaymentError) return null;
      if ((error as { code?: string })?.code === "P2034") return null;
      if (key && isUniqueViolation(error)) {
        const payment = await prisma.payment.findUnique({ where: { idempotencyKey: key } });
        const updated = await prisma.invoice.findUnique({ where: { id } });
        if (payment && updated) return { payment, updated, newStatus: updated.status };
      }
      throw error;
    });

    if (!result) {
      return apiError(
        "Payment could not be recorded because the balance changed. Refresh the invoice and try again.",
        409,
      );
    }

    // Notify admin of payment
    sendPushToRole("ADMIN", {
      title: result.newStatus === InvoiceStatus.PAID ? "Invoice Paid in Full" : "Partial Payment Received",
      body: `$${parsed.data.amount.toFixed(2)} via ${parsed.data.method.replace(/_/g, " ")}`,
      url: `/invoices/${id}`,
      tag: `payment-${id}`,
    }).catch(() => {});

    await logAudit(session!.user.id, AuditAction.PAYMENT, "Invoice", id, null, {
      paymentId: result.payment.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
    });

    return apiSuccess({ invoice: result.updated, payment: result.payment });
  }

  // Standard update — only descriptive fields and explicit void/refund status.
  // Totals, customer/job links and payment state are never mass-assignable.
  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);
  if (parsed.data.status && !["ADMIN", "ACCOUNTANT"].includes(session!.user.role)) {
    return apiError("Only admin or accounting can void an invoice", 403);
  }
  if (body.status === "REFUNDED") {
    return apiError("Use Refund on a payment; the invoice status updates automatically", 400);
  }
  if (parsed.data.status === "VOID" && Number(existing.amountPaid) > 0.005) {
    return apiError("Refund the payments on this invoice before voiding it", 400);
  }

  const { dueDate, status, voidReason, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (status) {
    data.status = status;
    data.voidedAt = new Date();
    if (voidReason) data.voidReason = voidReason;
  }

  const updated = await prisma.invoice.update({ where: { id }, data });
  await logAudit(session!.user.id, AuditAction.UPDATE, "Invoice", id, existing, updated);

  return apiSuccess(updated);
}
