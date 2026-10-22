import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, InvoiceStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";

const installmentSchema = z.object({
  installments: z.array(z.object({
    dueDate: z.string(),
    amount: z.number().positive(),
  })).min(2).max(12),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const installments = await prisma.paymentPlanInstallment.findMany({
    where: { invoiceId: id },
    orderBy: { dueDate: "asc" },
  });

  return apiSuccess(installments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = installmentSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid data", 400);

  const paidCount = await prisma.paymentPlanInstallment.count({ where: { invoiceId: id, status: "PAID" } });
  if (paidCount > 0) return apiError("This plan already has paid installments and can't be replaced", 409);

  await prisma.paymentPlanInstallment.deleteMany({ where: { invoiceId: id } });

  const created = await prisma.$transaction(
    parsed.data.installments.map((inst) =>
      prisma.paymentPlanInstallment.create({
        data: {
          invoiceId: id,
          dueDate: new Date(inst.dueDate),
          amount: inst.amount,
        },
      })
    )
  );

  return apiSuccess(created, 201);
}

const markPaidSchema = z.object({
  installmentId: z.string().min(1),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.OTHER),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const parsed = markPaidSchema.safeParse(await req.json());
  if (!parsed.success) return apiError("installmentId required", 400);

  const installment = await prisma.paymentPlanInstallment.findFirst({
    where: { id: parsed.data.installmentId, invoiceId: id },
  });
  if (!installment) return apiError("Installment not found", 404);

  const noteFor = (dueDate: Date) => `Payment plan installment due ${dueDate.toISOString().slice(0, 10)}`;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id }, include: { payments: true } });
      if (!invoice) throw new PlanError("Invoice not found", 404);
      if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.REFUNDED) {
        throw new PlanError(`Invoice is ${invoice.status.toLowerCase()}; payments can't be recorded`, 409);
      }

      const claimed = await tx.paymentPlanInstallment.updateMany({
        where: { id: installment.id, status: { not: "PAID" } },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (!claimed.count) throw new PlanError("Installment already paid", 409);

      // Installments marked paid by older builds have no Payment row; record them once.
      const unmatched = new Map<string, number>();
      for (const p of invoice.payments) if (p.notes) unmatched.set(p.notes, (unmatched.get(p.notes) ?? 0) + 1);
      const legacy = await tx.paymentPlanInstallment.findMany({
        where: { invoiceId: id, status: "PAID", id: { not: installment.id } },
      });
      let priorPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      for (const inst of legacy) {
        const note = noteFor(inst.dueDate);
        const left = unmatched.get(note) ?? 0;
        if (left > 0) {
          unmatched.set(note, left - 1);
          continue;
        }
        const legacyAmount = Number(inst.paidAmount ?? inst.amount);
        await tx.payment.create({
          data: { invoiceId: id, amount: legacyAmount, method: PaymentMethod.OTHER, notes: noteFor(inst.dueDate) },
        });
        priorPaid += legacyAmount;
      }

      const settle = async (totalPaid: number) => {
        const amountDue = Math.max(0, Math.round((Number(invoice.totalAmount) - totalPaid) * 100) / 100);
        const status = amountDue <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;
        const updated = await tx.invoice.update({
          where: { id },
          data: {
            amountPaid: totalPaid,
            amountDue,
            status,
            paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
          },
        });
        if (status === InvoiceStatus.PAID) {
          await tx.job.update({ where: { id: invoice.jobId }, data: { status: "PAID" } });
        }
        return updated;
      };

      const remaining = Math.round((Number(invoice.totalAmount) - priorPaid) * 100) / 100;
      if (remaining <= 0) {
        // Legacy payments already cover the invoice: keep the backfill, release this claim.
        await tx.paymentPlanInstallment.update({
          where: { id: installment.id },
          data: { status: installment.status, paidAt: installment.paidAt },
        });
        await settle(priorPaid);
        return { conflict: "Invoice is already paid in full" } as const;
      }

      const amount = Math.min(Number(installment.amount), remaining);

      const updatedInstallment = await tx.paymentPlanInstallment.update({
        where: { id: installment.id },
        data: { paidAmount: amount },
      });
      const payment = await tx.payment.create({
        data: { invoiceId: id, amount, method: parsed.data.method, notes: noteFor(installment.dueDate) },
      });
      const updatedInvoice = await settle(priorPaid + amount);
      return { updatedInstallment, payment, updatedInvoice, amount };
    });
  } catch (e) {
    if (e instanceof PlanError) return apiError(e.message, e.status);
    throw e;
  }
  if ("conflict" in result) return apiError(String(result.conflict), 409);
  const { updatedInstallment, payment, updatedInvoice, amount } = result;

  await logAudit(session!.user.id, AuditAction.PAYMENT, "Invoice", id, null, {
    paymentId: payment.id,
    installmentId: installment.id,
    amount,
    method: parsed.data.method,
  });

  return apiSuccess({ installment: updatedInstallment, payment, invoice: updatedInvoice });
}

class PlanError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
