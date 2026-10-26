import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";
import { findApprovedRun, type PayrollSnapshot } from "@/lib/payroll";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const periodDate = (v: string) => new Date(`${v}T00:00:00.000Z`);

const createSchema = z.object({
  userId: z.string().min(1),
  start: z.string().regex(DATE),
  end: z.string().regex(DATE),
  hours: z.number().nonnegative().default(0),
  amount: z.number().nonnegative(),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end || !DATE.test(start) || !DATE.test(end)) return apiError("start and end (YYYY-MM-DD) are required");

  const payouts = await prisma.payrollPayout.findMany({
    where: { periodStart: periodDate(start), periodEnd: periodDate(end) },
    orderBy: { paidAt: "desc" },
  });
  return apiSuccess(payouts);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return apiError(parsed.error.issues[0].message);
  const { userId, start, end, hours, amount, note } = parsed.data;
  if (start > end) return apiError("start must be on or before end");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return apiError("User not found", 404);

  const periodStart = periodDate(start);
  const periodEnd = periodDate(end);
  const overlap = await prisma.payrollPayout.findFirst({
    where: { userId, periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
    select: { periodStart: true, periodEnd: true },
  });
  if (overlap) {
    const d = (x: Date) => x.toISOString().slice(0, 10);
    return apiError(`Already paid for ${d(overlap.periodStart)} to ${d(overlap.periodEnd)}, which overlaps this period`, 409);
  }

  // When the period is approved, the payout must match the frozen snapshot.
  let paidHours = hours;
  let paidAmount = amount;
  const run = await findApprovedRun(start, end);
  if (run) {
    const line = (run.snapshot as unknown as PayrollSnapshot).technicians.find((t) => t.userId === userId);
    if (!line) return apiError("This person is not in the approved payroll for this period", 400);
    paidHours = line.totalHours;
    paidAmount = line.grossPay;
  } else {
    const approvedOverlap = await prisma.payrollRun.findFirst({
      where: { periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
      select: { id: true },
    });
    if (approvedOverlap) return apiError("Pay out using the exact dates of the approved payroll period", 409);
  }

  const payout = await prisma.payrollPayout.create({
    data: { userId, periodStart, periodEnd, hours: paidHours, amount: paidAmount, note, paidById: session!.user.id },
  });
  return apiSuccess(payout, 201);
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return apiError("id is required");
  const existing = await prisma.payrollPayout.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return apiError("Payout not found", 404);
  await prisma.payrollPayout.delete({ where: { id } });
  return apiSuccess({ ok: true });
}
