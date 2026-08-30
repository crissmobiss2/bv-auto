import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, InvoiceStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { sendPushToRole } from "@/lib/push";

const paymentSchema = z.object({
  action: z.literal("payment"),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
  receivedAt: z.string().optional(),
});

// Whitelist of fields a standard PATCH may change. Money columns
// (amountDue/amountPaid/totalAmount/subtotal…) are intentionally excluded —
// balances only move through the guarded payment path or the Stripe webhook.
const updateSchema = z.object({
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  dueDate: z.string().datetime().nullish(),
  status: z.nativeEnum(InvoiceStatus).optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, shopId },
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
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.invoice.findFirst({
    where: { id, shopId },
    include: { payments: true },
  });
  if (!existing) return apiError("Invoice not found", 404);

  // Handle payment recording
  if (body.action === "payment") {
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0].message);

    if (existing.status === InvoiceStatus.VOID || existing.status === InvoiceStatus.REFUNDED) {
      return apiError(`Cannot record a payment against a ${existing.status.toLowerCase()} invoice`, 409);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totalPaid = round2(
      existing.payments.reduce((sum, p) => sum + Number(p.amount), 0) + parsed.data.amount
    );
    const amountDue = round2(Math.max(0, Number(existing.totalAmount) - totalPaid));
    const newStatus: InvoiceStatus =
      amountDue <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

    // Atomic: record the payment and update the balance together so a mid-way
    // failure can't orphan a payment or leave the ledger stale.
    const [payment, updated] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: id,
          amount: parsed.data.amount,
          method: parsed.data.method,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
          receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date(),
        },
      }),
      prisma.invoice.update({
        where: { id },
        data: {
          amountPaid: totalPaid,
          amountDue,
          status: newStatus,
          paidAt: newStatus === InvoiceStatus.PAID ? new Date() : undefined,
        },
      }),
    ]);

    if (newStatus === InvoiceStatus.PAID) {
      await prisma.job.update({ where: { id: existing.jobId }, data: { status: "PAID" } });
    }

    // Notify admin of payment
    sendPushToRole("ADMIN", {
      title: newStatus === InvoiceStatus.PAID ? "Invoice Paid in Full" : "Partial Payment Received",
      body: `$${parsed.data.amount.toFixed(2)} via ${parsed.data.method.replace(/_/g, " ")}`,
      url: `/invoices/${id}`,
      tag: `payment-${id}`,
    }).catch(() => {});

    await logAudit(session!.user.id, AuditAction.PAYMENT, "Invoice", id, null, {
      paymentId: payment.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
    });

    return apiSuccess({ invoice: updated, payment });
  }

  // Standard update — whitelisted fields only (never money columns).
  const parsedUpdate = updateSchema.safeParse(body);
  if (!parsedUpdate.success) return apiError(parsedUpdate.error.issues[0].message);
  const data = parsedUpdate.data;

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      notes: data.notes,
      internalNotes: data.internalNotes,
      dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      status: data.status,
      voidedAt: data.status === InvoiceStatus.VOID ? new Date() : undefined,
    },
  });
  await logAudit(session!.user.id, AuditAction.UPDATE, "Invoice", id, existing, updated);

  return apiSuccess(updated);
}
