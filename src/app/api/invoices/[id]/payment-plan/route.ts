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
  if (installment.status === "PAID") return apiError("Installment already paid", 409);

  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  if (!invoice) return apiError("Invoice not found", 404);
  if (Number(invoice.amountDue) <= 0) return apiError("Invoice is already paid in full", 409);

  const amount = Math.min(Number(installment.amount), Number(invoice.amountDue));
  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) + amount;
  const amountDue = Math.max(0, Math.round((Number(invoice.totalAmount) - totalPaid) * 100) / 100);
  const status = amountDue <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

  const [updatedInstallment, payment, updatedInvoice] = await prisma.$transaction([
    prisma.paymentPlanInstallment.update({
      where: { id: installment.id },
      data: { paidAt: new Date(), paidAmount: amount, status: "PAID" },
    }),
    prisma.payment.create({
      data: {
        invoiceId: id,
        amount,
        method: parsed.data.method,
        notes: `Payment plan installment due ${installment.dueDate.toISOString().slice(0, 10)}`,
      },
    }),
    prisma.invoice.update({
      where: { id },
      data: {
        amountPaid: totalPaid,
        amountDue,
        status,
        paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
      },
    }),
    ...(status === InvoiceStatus.PAID
      ? [prisma.job.update({ where: { id: invoice.jobId }, data: { status: "PAID" } })]
      : []),
  ]);

  await logAudit(session!.user.id, AuditAction.PAYMENT, "Invoice", id, null, {
    paymentId: payment.id,
    installmentId: installment.id,
    amount,
    method: parsed.data.method,
  });

  return apiSuccess({ installment: updatedInstallment, payment, invoice: updatedInvoice });
}
