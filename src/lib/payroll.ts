import { prisma } from "@/lib/prisma";

// FLSA default: hours over 40 in a workweek (Monday start, server-local) at 1.5x.
export const OT_THRESHOLD_HOURS = 40;
export const OT_MULTIPLIER = 1.5;

const r2 = (n: number) => Math.round(n * 100) / 100;

export type PayrollLog = {
  id: string;
  jobId: string;
  clockedIn: Date;
  clockedOut: Date | null;
  job: { title: string | null; invoice: { totalAmount: unknown } | null } | null;
};

export type PayrollStaff = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  payrollRate: { rateType: string; hourlyRate: unknown; flatRateMul: unknown; commissionPct: unknown } | null;
  timeLogs: PayrollLog[];
};

export type TechPayroll = ReturnType<typeof computeTechPay>;

export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Hours of [start, end) per workweek, split at Monday 00:00 so overnight shifts count in both weeks. */
function weekSegments(start: Date, end: Date) {
  const out: { week: string; hours: number }[] = [];
  let s = start;
  while (s < end) {
    const ws = weekStart(s);
    const next = new Date(ws);
    next.setDate(next.getDate() + 7);
    const e = next < end ? next : end;
    out.push({ week: ws.toDateString(), hours: (e.getTime() - s.getTime()) / 3600000 });
    s = e;
  }
  return out;
}

/**
 * `periodStart`: logs before it only count toward that week's 40-hour threshold
 * (a workweek split across two pay periods); they are not paid again.
 */
export function computeTechPay(tech: PayrollStaff, periodStart?: Date) {
  const rate = tech.payrollRate;
  const payType = rate?.rateType || "HOURLY";
  const rateValue = payType === "COMMISSION" ? Number(rate?.commissionPct || 0) : Number(rate?.hourlyRate || 0);
  const flatRateMul = Number(rate?.flatRateMul || 1.0);

  const all = tech.timeLogs
    .filter((l) => l.clockedOut)
    .sort((a, b) => a.clockedIn.getTime() - b.clockedIn.getTime());
  const weekHours = new Map<string, number>();
  const addWeekHours = (l: PayrollLog) => {
    let ot = 0;
    for (const seg of weekSegments(l.clockedIn, l.clockedOut!)) {
      const before = weekHours.get(seg.week) ?? 0;
      weekHours.set(seg.week, before + seg.hours);
      ot += Math.max(0, before + seg.hours - Math.max(before, OT_THRESHOLD_HOURS));
    }
    return ot;
  };
  const logs = periodStart ? all.filter((l) => l.clockedIn >= periodStart) : all;
  if (payType === "HOURLY" && periodStart) {
    for (const l of all) if (l.clockedIn < periodStart) addWeekHours(l);
  }
  const commissionedJobs = new Set<string>();
  let grossPay = 0;
  let totalHours = 0;
  let overtimeHours = 0;

  const details = logs.map((l) => {
    const hours = Math.round((l.clockedOut!.getTime() - l.clockedIn.getTime()) / 60000) / 60;
    totalHours += hours;
    let pay = 0;
    let ot = 0;
    if (payType === "HOURLY") {
      ot = Math.min(hours, Math.round(addWeekHours(l) * 60) / 60);
      pay = (hours - ot) * rateValue + ot * rateValue * OT_MULTIPLIER;
    } else if (payType === "FLAT_RATE") {
      pay = hours * flatRateMul * (rateValue || 25);
    } else if (payType === "COMMISSION" && !commissionedJobs.has(l.jobId)) {
      // Commission is earned once per job, however many clock-ins it took.
      commissionedJobs.add(l.jobId);
      pay = Number(l.job?.invoice?.totalAmount || 0) * (rateValue / 100);
    }
    pay = r2(pay);
    grossPay += pay;
    overtimeHours += ot;
    return {
      logId: l.id,
      jobId: l.jobId,
      jobTitle: l.job?.title || "Untitled job",
      hours: r2(hours),
      overtimeHours: r2(ot),
      pay,
      type: payType,
    };
  });

  return {
    userId: tech.id,
    name: tech.name,
    email: tech.email,
    role: tech.role,
    payType,
    rate: rateValue,
    totalHours: r2(totalHours),
    overtimeHours: r2(overtimeHours),
    totalJobs: new Set(logs.map((l) => l.jobId)).size,
    grossPay: r2(grossPay),
    details,
  };
}

/** Everyone who is paid: technicians/admins, anyone with a pay profile, or anyone who logged time (FIN-010). */
export async function buildPayroll(from: Date, to: Date) {
  const window = { clockedIn: { gte: from }, clockedOut: { lte: to } };
  // Earlier days of the first workweek count toward its overtime threshold.
  const logWindow = { clockedIn: { gte: weekStart(from) }, clockedOut: { lte: to } };
  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: ["TECHNICIAN", "ADMIN"] } },
        { payrollRate: { isNot: null } },
        { timeLogs: { some: window } },
      ],
    },
    include: {
      payrollRate: true,
      timeLogs: {
        where: logWindow,
        include: { job: { select: { id: true, jobNumber: true, title: true, invoice: { select: { totalAmount: true } } } } },
      },
    },
  });
  return staff.map((s) => computeTechPay(s, from));
}

export function summarizePayroll(technicians: TechPayroll[]) {
  const totalGross = technicians.reduce((s, p) => s + p.grossPay, 0);
  const totalHours = technicians.reduce((s, p) => s + p.totalHours, 0);
  return {
    techCount: technicians.length,
    totalPayroll: r2(totalGross),
    totalHours: r2(totalHours),
    avgPay: technicians.length ? r2(totalGross / technicians.length) : 0,
  };
}

export const PERIOD_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Storage key for a YYYY-MM-DD period day (matches PayrollPayout). */
export const periodKey = (v: string) => new Date(`${v}T00:00:00.000Z`);
/** The local-day instant a YYYY-MM-DD boundary refers to. */
export const periodDay = (v: string, endOfDay = false) =>
  new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);

export type PayrollSnapshot = { technicians: TechPayroll[]; summary: ReturnType<typeof summarizePayroll> };

export function findApprovedRun(start: string, end: string) {
  return prisma.payrollRun.findFirst({
    where: { periodStart: periodKey(start), periodEnd: periodKey(end) },
  });
}
