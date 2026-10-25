import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess } from "@/lib/api-helpers";

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

  const staff = await prisma.user.findMany({
    where: { role: { in: ["TECHNICIAN", "ADMIN"] }, isActive: true },
    include: {
      payrollRate: true,
      timeLogs: {
        where: { clockedIn: { gte: from }, clockedOut: { lte: to } },
        include: { job: { select: { id: true, jobNumber: true, title: true, invoice: { select: { totalAmount: true } } } } },
      },
    },
  });

  const technicians = staff.map((tech) => {
    const logs = tech.timeLogs;
    const rate = tech.payrollRate;
    const payType = rate?.rateType || "HOURLY";
    const rateValue = payType === "COMMISSION"
      ? Number(rate?.commissionPct || 0)
      : Number(rate?.hourlyRate || 0);
    const flatRateMul = Number(rate?.flatRateMul || 1.0);

    let grossPay = 0;
    const details = logs
      .flatMap((l) => {
        const clockedOut = l.clockedOut;
        if (!clockedOut) return [];
        const minutes = Math.round((clockedOut.getTime() - l.clockedIn.getTime()) / 60000);
        const hours = minutes / 60;
        let pay = 0;
        if (payType === "HOURLY") pay = hours * rateValue;
        else if (payType === "FLAT_RATE") pay = hours * flatRateMul * (rateValue || 25);
        else if (payType === "COMMISSION") pay = Number(l.job?.invoice?.totalAmount || 0) * (rateValue / 100);
        pay = Math.round(pay * 100) / 100;
        grossPay += pay;
        return [{
          jobId: l.jobId,
          jobTitle: l.job?.title || "Untitled job",
          hours: Math.round(hours * 100) / 100,
          pay,
          type: payType,
        }];
      });

    return {
      userId: tech.id,
      name: tech.name,
      email: tech.email,
      role: tech.role,
      payType,
      rate: rateValue,
      totalHours: Math.round((logs.reduce((s, l) => {
        if (!l.clockedOut) return s;
        return s + (new Date(l.clockedOut).getTime() - new Date(l.clockedIn).getTime()) / 3600000;
      }, 0)) * 100) / 100,
      totalJobs: new Set(logs.map((l) => l.jobId)).size,
      grossPay: Math.round(grossPay * 100) / 100,
      details,
    };
  });

  if (format === "csv") {
    // Neutralize spreadsheet formulas and always quote/escape text cells.
    // A technician or job title beginning with =, +, -, or @ must not execute
    // when an accountant opens the export in Excel/Sheets.
    const csvCell = (value: unknown) => {
      const text = String(value ?? "");
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = ["Name,Role,Rate Type,Rate,Total Hours,Gross Pay,Job Count"];
    for (const p of technicians) {
      rows.push([
        p.name,
        p.role,
        p.payType,
        p.rate,
        p.totalHours,
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
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payroll-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const totalGross = technicians.reduce((s, p) => s + p.grossPay, 0);
  const totalHours = technicians.reduce((s, p) => s + p.totalHours, 0);

  return apiSuccess({
    technicians,
    summary: {
      techCount: technicians.length,
      totalPayroll: Math.round(totalGross * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      avgPay: technicians.length ? Math.round((totalGross / technicians.length) * 100) / 100 : 0,
    },
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
