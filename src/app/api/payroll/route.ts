import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(new Date().setDate(1));
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
  const format = searchParams.get("format");

  const technicians = await prisma.user.findMany({
    where: { role: { in: ["TECHNICIAN", "ADMIN"] }, isActive: true },
    include: {
      payrollRate: true,
      timeLogs: {
        where: { clockedIn: { gte: from }, clockedOut: { lte: to } },
        include: { job: { select: { id: true, jobNumber: true, title: true, invoice: { select: { totalAmount: true } } } } },
      },
    },
  });

  const payroll = technicians.map(tech => {
    const logs = tech.timeLogs;
    const totalMinutes = logs.reduce((s, l) => {
      if (!l.clockedOut) return s;
      return s + Math.round((new Date(l.clockedOut).getTime() - new Date(l.clockedIn).getTime()) / 60000);
    }, 0);
    const totalHours = totalMinutes / 60;

    const rate = tech.payrollRate;
    const rateType = rate?.rateType || "HOURLY";
    const hourlyRate = Number(rate?.hourlyRate || 0);
    const flatRateMul = Number(rate?.flatRateMul || 1.0);
    const commissionPct = Number(rate?.commissionPct || 0);

    let grossPay = 0;
    if (rateType === "HOURLY") grossPay = totalHours * hourlyRate;
    else if (rateType === "FLAT_RATE") grossPay = totalHours * flatRateMul * (hourlyRate || 25);
    else if (rateType === "COMMISSION") {
      const totalRevenue = logs.reduce((s, l) => s + Number(l.job?.invoice?.totalAmount || 0), 0);
      grossPay = totalRevenue * (commissionPct / 100);
    }

    const jobBreakdown = logs.map(l => ({
      jobNumber: l.job?.jobNumber,
      jobTitle: l.job?.title,
      clockedIn: l.clockedIn,
      clockedOut: l.clockedOut,
      minutes: l.clockedOut
        ? Math.round((new Date(l.clockedOut).getTime() - new Date(l.clockedIn).getTime()) / 60000)
        : null,
    }));

    return {
      id: tech.id,
      name: tech.name,
      email: tech.email,
      role: tech.role,
      rateType,
      hourlyRate,
      totalHours: Math.round(totalHours * 100) / 100,
      totalMinutes,
      grossPay: Math.round(grossPay * 100) / 100,
      jobCount: new Set(logs.map(l => l.jobId)).size,
      jobBreakdown,
    };
  });

  if (format === "csv") {
    const rows = ["Name,Role,Rate Type,Hourly Rate,Total Hours,Gross Pay,Job Count"];
    for (const p of payroll) {
      rows.push(`"${p.name}",${p.role},${p.rateType},${p.hourlyRate},${p.totalHours},${p.grossPay},${p.jobCount}`);
    }
    // Detail rows
    rows.push("", "JOB DETAIL", "Tech Name,Job Number,Job Title,Clock In,Clock Out,Minutes");
    for (const p of payroll) {
      for (const j of p.jobBreakdown) {
        rows.push(`"${p.name}","${j.jobNumber || ""}","${j.jobTitle || ""}",${j.clockedIn},${j.clockedOut || ""},${j.minutes || ""}`);
      }
    }
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payroll-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const totalGross = payroll.reduce((s, p) => s + p.grossPay, 0);
  const totalHours = payroll.reduce((s, p) => s + p.totalHours, 0);

  return apiSuccess({ payroll, totals: { grossPay: Math.round(totalGross * 100) / 100, hours: Math.round(totalHours * 100) / 100 }, period: { from, to } });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { userId, rateType, hourlyRate, flatRateMul, commissionPct } = await req.json();

  const rate = await prisma.payrollRate.upsert({
    where: { userId },
    create: { userId, rateType, hourlyRate: hourlyRate ? Number(hourlyRate) : null, flatRateMul: flatRateMul ? Number(flatRateMul) : 1.0, commissionPct: commissionPct ? Number(commissionPct) : 0 },
    update: { rateType, hourlyRate: hourlyRate ? Number(hourlyRate) : null, flatRateMul: flatRateMul ? Number(flatRateMul) : 1.0, commissionPct: commissionPct ? Number(commissionPct) : 0 },
  });

  return apiSuccess(rate);
}
