import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const updateFleetSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  billingTerms: z.string().optional(),
  customLaborRate: z.coerce.number().nonnegative().nullable().optional(),
  poRequired: z.boolean().optional(),
  creditLimit: z.coerce.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).partial();

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "DISPATCHER", "ACCOUNTANT"]);
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
  const { error } = await requireRole(["ADMIN", "DISPATCHER", "ACCOUNTANT"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateFleetSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const { email, ...rest } = parsed.data;
  const account = await prisma.fleetAccount.update({
    where: { id },
    data: { ...rest, ...(email !== undefined && { email: email || null }) },
  });

  return apiSuccess(account);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "DISPATCHER", "ACCOUNTANT"]);
  if (error) return error;

  const { id } = await params;
  await prisma.fleetAccount.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ ok: true });
}
