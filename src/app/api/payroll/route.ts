import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess } from "@/lib/api-helpers";
import {
  PERIOD_DATE,
  buildPayroll,
  findApprovedRun,
  summarizePayroll,
  type PayrollSnapshot,
  type TechPayroll,
} from "@/lib/payroll";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get("from") || searchParams.get("start");
  const toParam = searchParams.get("to") || searchParams.get("end");
  // Date-only params (YYYY-MM-DD) must be treated as LOCAL days, not UTC —
  // `new Date("2026-10-01")` lands at 7pm on Sep 30 in US timezones.
  const parseDateParam = (v: string | null, endOfDay = false) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
    }
    return new Date(v);
  };
  const from = parseDateParam(fromParam) ?? new Date(new Date().setDate(1));
  const to = parseDateParam(toParam, true) ?? new Date();
  const format = searchParams.get("format");

  // An approved period is served from its frozen snapshot (FIN-006).
  const run =
    fromParam && toParam && PERIOD_DATE.test(fromParam) && PERIOD_DATE.test(toParam)
      ? await findApprovedRun(fromParam, toParam)
      : null;
  const technicians: TechPayroll[] = run
    ? (run.snapshot as unknown as PayrollSnapshot).technicians
    : await buildPayroll(from, to);
  const runInfo = run ? { id: run.id, status: run.status, approvedAt: run.approvedAt } : null;

  if (format === "csv") {
    // Neutralize spreadsheet formulas and always quote/escape text cells.
    // A technician or job title beginning with =, +, -, or @ must not execute
    // when an accountant opens the export in Excel/Sheets.
    const csvCell = (value: unknown) => {
      const text = String(value ?? "");
      const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = ["Name,Role,Rate Type,Rate,Total Hours,Overtime Hours,Gross Pay,Job Count"];
    for (const p of technicians) {
      rows.push([
        p.name,
        p.role,
        p.payType,
        p.rate,
        p.totalHours,
        p.overtimeHours ?? 0,
        p.grossPay,
        p.totalJobs,
      ].map(csvCell).join(","));
    }
    // Detail rows
    rows.push("", "JOB DETAIL", "Tech Name,Job Title,Hours,Pay,Type");
    for (const p of technicians) {
      for (const j of p.details) {
        rows.push([
          p.name,
          j.jobTitle,
          j.hours ?? "",
          j.pay,
          j.type,
        ].map(csvCell).join(","));
      }
    }
    rows.push("", csvCell(run
      ? `APPROVED payroll run ${run.id} (${run.approvedAt.toISOString()})`
      : "ESTIMATE - period not approved; amounts may still change"));
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payroll-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}-${run ? "approved" : "estimate"}.csv"`,
      },
    });
  }

  return apiSuccess({
    technicians,
    summary: summarizePayroll(technicians),
    run: runInfo,
    period: { from, to },
  });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const body = await req.json();
  const userId: string = body.userId;
  // Accept both the page's simple shape {payType, rate} and the detailed one
  const rateType: string = body.rateType || body.payType || "HOURLY";
  const rate = body.rate != null ? Number(body.rate) : null;
  const hourlyRate = body.hourlyRate != null ? Number(body.hourlyRate) : rateType === "COMMISSION" ? null : rate;
  const commissionPct = body.commissionPct != null ? Number(body.commissionPct) : rateType === "COMMISSION" ? (rate ?? 0) : 0;

  const pay = await prisma.payrollRate.upsert({
    where: { userId },
    create: { userId, rateType, hourlyRate: hourlyRate ?? undefined, flatRateMul: body.flatRateMul != null ? Number(body.flatRateMul) : 1.0, commissionPct },
    update: { rateType, hourlyRate: hourlyRate ?? undefined, flatRateMul: body.flatRateMul != null ? Number(body.flatRateMul) : undefined, commissionPct },
  });

  return apiSuccess(pay);
}
