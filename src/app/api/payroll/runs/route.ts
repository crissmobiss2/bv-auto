import { NextRequest } from "next/server";
import { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess, apiError, logAudit } from "@/lib/api-helpers";
import { isUniqueViolation } from "@/lib/payments";
import {
  PERIOD_DATE,
  buildPayroll,
  findApprovedRun,
  periodDay,
  periodKey,
  summarizePayroll,
} from "@/lib/payroll";

const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const createSchema = z.object({
  start: z.string().regex(PERIOD_DATE),
  end: z.string().regex(PERIOD_DATE),
});

const PAYROLL_RUN_LOCK = 724_001;

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end || !PERIOD_DATE.test(start) || !PERIOD_DATE.test(end)) {
    return apiError("start and end (YYYY-MM-DD) are required");
  }
  const run = await findApprovedRun(start, end);
  return apiSuccess(run ? { id: run.id, status: run.status, approvedAt: run.approvedAt, approvedById: run.approvedById, totalGross: run.totalGross } : null);
}

// Approve and lock a finished period: the current calculation is frozen.
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return apiError(parsed.error.issues[0].message);
  const { start, end } = parsed.data;
  if (start > end) return apiError("start must be on or before end");
  if (end >= toLocalDate(new Date())) return apiError("Only a period that has already ended can be approved", 400);

  const from = periodDay(start);
  const to = periodDay(end, true);
  const openLogs = await prisma.timeLog.count({ where: { clockedIn: { gte: from, lte: to }, clockedOut: null } });
  if (openLogs > 0) return apiError(`${openLogs} time log(s) in this period are still clocked in`, 409);

  const technicians = await buildPayroll(from, to);
  const summary = summarizePayroll(technicians);
  try {
    // Approvals are serialized so two overlapping periods can't both pass the overlap check.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PAYROLL_RUN_LOCK})`;
      const overlap = await tx.payrollRun.findFirst({
        where: { periodStart: { lte: periodKey(end) }, periodEnd: { gte: periodKey(start) } },
        select: { periodStart: true, periodEnd: true },
      });
      if (overlap) return { overlap, run: null };
      const run = await tx.payrollRun.create({
        data: {
          periodStart: periodKey(start),
          periodEnd: periodKey(end),
          snapshot: { technicians, summary } as unknown as Prisma.InputJsonValue,
          totalGross: summary.totalPayroll,
          approvedById: session!.user.id,
        },
      });
      return { overlap: null, run };
    });
    const { overlap, run } = result;
    if (!run) {
      const d = (x: Date) => x.toISOString().slice(0, 10);
      return apiError(`Payroll for ${d(overlap!.periodStart)} to ${d(overlap!.periodEnd)} is already approved and overlaps this period`, 409);
    }
    await logAudit(session!.user.id, AuditAction.CREATE, "PayrollRun", run.id, null, { start, end, totalGross: summary.totalPayroll });
    return apiSuccess({ id: run.id, status: run.status, approvedAt: run.approvedAt, totalGross: run.totalGross }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return apiError("This period is already approved", 409);
    throw e;
  }
}

// Reopen a period (admin only; audited). Recorded payouts are kept.
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["ADMIN"]);
  if (error) return error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return apiError("id is required");
  const run = await prisma.payrollRun.findUnique({ where: { id } });
  if (!run) return apiError("Payroll run not found", 404);
  await prisma.payrollRun.delete({ where: { id } });
  await logAudit(session!.user.id, AuditAction.DELETE, "PayrollRun", id, {
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    totalGross: run.totalGross,
  }, null);
  return apiSuccess({ ok: true });
}
