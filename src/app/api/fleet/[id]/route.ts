import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const account = await prisma.fleetAccount.findUnique({
    where: { id },
    include: {
      jobs: {
        include: {
          vehicle: { select: { year: true, make: true, model: true, plate: true } },
          invoice: { select: { totalAmount: true, amountDue: true, status: true, invoiceNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!account) return apiError("Fleet account not found", 404);

  const totalRevenue = account.jobs.reduce(
    (s, j) => s + (j.invoice ? Number(j.invoice.totalAmount) : 0), 0
  );
  const openBalance = account.jobs.reduce(
    (s, j) => s + (j.invoice?.status && ["SENT","VIEWED","PARTIAL","OVERDUE"].includes(j.invoice.status) ? Number(j.invoice.amountDue) : 0), 0
  );

  return apiSuccess({ ...account, totalRevenue, openBalance });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const account = await prisma.fleetAccount.update({
    where: { id },
    data: {
      ...body,
      customLaborRate: body.customLaborRate != null ? Number(body.customLaborRate) : undefined,
      creditLimit: body.creditLimit != null ? Number(body.creditLimit) : undefined,
    },
  });

  return apiSuccess(account);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await prisma.fleetAccount.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ ok: true });
}
