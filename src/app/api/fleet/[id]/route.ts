import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError, pick } from "@/lib/api-helpers";

const FLEET_ROLES = ["ADMIN", "DISPATCHER", "ACCOUNTANT"] as const;
const FLEET_FIELDS = [
  "name", "contactName", "email", "phone", "address", "city", "state", "zip",
  "billingTerms", "customLaborRate", "poRequired", "creditLimit", "notes", "isActive",
] as const;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop(FLEET_ROLES);
  if (error) return error;

  const { id } = await params;

  const account = await prisma.fleetAccount.findFirst({
    where: { id, shopId },
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
  const { error, shopId } = await requireShop(FLEET_ROLES);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.fleetAccount.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Fleet account not found", 404);

  const account = await prisma.fleetAccount.update({
    where: { id },
    data: {
      ...pick(body, FLEET_FIELDS),
      customLaborRate: body.customLaborRate != null ? Number(body.customLaborRate) : undefined,
      creditLimit: body.creditLimit != null ? Number(body.creditLimit) : undefined,
    },
  });

  return apiSuccess(account);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop(FLEET_ROLES);
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.fleetAccount.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Fleet account not found", 404);
  await prisma.fleetAccount.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ ok: true });
}
