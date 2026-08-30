import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

const installmentSchema = z.object({
  installments: z.array(z.object({
    dueDate: z.string(),
    amount: z.number().positive(),
  })).min(2).max(12),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, shopId }, select: { id: true } });
  if (!invoice) return apiError("Invoice not found", 404);

  const installments = await prisma.paymentPlanInstallment.findMany({
    where: { invoiceId: id },
    orderBy: { dueDate: "asc" },
  });

  return apiSuccess(installments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, shopId }, select: { id: true } });
  if (!invoice) return apiError("Invoice not found", 404);

  const body = await req.json();
  const parsed = installmentSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid data", 400);

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const installmentId: string | undefined = body.installmentId;
  const paidAmount = Number(body.paidAmount);
  if (!installmentId || !paidAmount || paidAmount <= 0) {
    return apiError("installmentId and a positive paidAmount are required", 400);
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id, shopId },
    include: { payments: true },
  });
  if (!invoice) return apiError("Invoice not found", 404);

  // The installment must belong to THIS invoice (prevents cross-invoice tampering).
  const installment = await prisma.paymentPlanInstallment.findFirst({
    where: { id: installmentId, invoiceId: id },
  });
  if (!installment) return apiError("Installment not found", 404);

  // Post the installment payment to the invoice ledger so the balance stays in sync.
  const totalPaid = round2(invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + paidAmount);
  const amountDue = round2(Math.max(0, Number(invoice.totalAmount) - totalPaid));
  const newStatus: InvoiceStatus = amountDue <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

  const [updatedInstallment] = await prisma.$transaction([
    prisma.paymentPlanInstallment.update({
      where: { id: installment.id },
      data: { paidAt: new Date(), paidAmount, status: "PAID" },
    }),
    prisma.payment.create({
      data: {
        invoiceId: id,
        amount: paidAmount,
        method: "OTHER",
        reference: `installment:${installment.id}`,
        notes: "Payment plan installment",
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

  return apiSuccess(updatedInstallment);
}
