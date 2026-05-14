import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, InvoiceStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";

const paymentSchema = z.object({
  action: z.literal("payment"),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
  receivedAt: z.string().optional(),
});

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

    const payment = await prisma.payment.create({
      data: {
        invoiceId: id,
        amount: parsed.data.amount,
        method: parsed.data.method,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date(),
      },
    });

    const totalPaid = existing.payments.reduce((sum, p) => sum + Number(p.amount), 0) + parsed.data.amount;
    const amountDue = Math.max(0, Number(existing.totalAmount) - totalPaid);
    const newStatus: InvoiceStatus =
      amountDue <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        amountPaid: totalPaid,
        amountDue,
        status: newStatus,
        paidAt: newStatus === InvoiceStatus.PAID ? new Date() : undefined,
      },
    });

    if (newStatus === InvoiceStatus.PAID) {
      await prisma.job.update({ where: { id: existing.jobId }, data: { status: "PAID" } });
    }

    await logAudit(session!.user.id, AuditAction.PAYMENT, "Invoice", id, null, {
      paymentId: payment.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
    });

    return apiSuccess({ invoice: updated, payment });
  }

  // Standard update
  const updated = await prisma.invoice.update({ where: { id }, data: body });
  await logAudit(session!.user.id, AuditAction.UPDATE, "Invoice", id, existing, updated);

  return apiSuccess(updated);
}
