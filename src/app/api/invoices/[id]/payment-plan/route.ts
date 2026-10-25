import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
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
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { installmentId, paidAmount } = body;
  if (!installmentId || paidAmount == null) return apiError("installmentId and paidAmount required", 400);

  const existing = await prisma.paymentPlanInstallment.findFirst({
    where: { id: installmentId, invoiceId: id },
  });
  if (!existing) return apiError("Installment not found on this invoice", 404);

  const amount = Number(paidAmount);
  if (!Number.isFinite(amount) || amount < 0 || amount > Number(existing.amount) + 0.005) {
    return apiError("paidAmount must be between 0 and the installment amount", 400);
  }

  const installment = await prisma.paymentPlanInstallment.update({
    where: { id: installmentId },
    data: {
      paidAt: new Date(),
      paidAmount: amount,
      status: amount >= Number(existing.amount) - 0.005 ? "PAID" : "PARTIAL",
    },
  });

  return apiSuccess(installment);
}
