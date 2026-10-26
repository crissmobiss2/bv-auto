import { describe, it, expect } from "vitest";
import { computeTechPay, type PayrollStaff } from "@/lib/payroll";

const log = (id: string, jobId: string, start: string, hours: number, total = 0) => ({
  id,
  jobId,
  clockedIn: new Date(start),
  clockedOut: new Date(new Date(start).getTime() + hours * 3600000),
  job: { title: `Job ${jobId}`, invoice: { totalAmount: total } },
});

const tech = (rateType: string, timeLogs: PayrollStaff["timeLogs"], extra: Partial<NonNullable<PayrollStaff["payrollRate"]>> = {}): PayrollStaff => ({
  id: "u1",
  name: "Tech",
  email: "t@example.com",
  role: "TECHNICIAN",
  payrollRate: { rateType, hourlyRate: 20, flatRateMul: 1, commissionPct: 10, ...extra },
  timeLogs,
});

describe("computeTechPay", () => {
  it("pays hours over 40 in one workweek at 1.5x", () => {
    // Monday 2026-10-05 and Wednesday 2026-10-07: 30h + 15h = 45h, 5h overtime.
    const p = computeTechPay(tech("HOURLY", [log("a", "j1", "2026-10-05T08:00:00", 30), log("b", "j2", "2026-10-07T08:00:00", 15)]));
    expect(p.totalHours).toBe(45);
    expect(p.overtimeHours).toBe(5);
    expect(p.grossPay).toBe(40 * 20 + 5 * 30);
  });

  it("does not combine hours from different workweeks", () => {
    const p = computeTechPay(tech("HOURLY", [log("a", "j1", "2026-10-05T08:00:00", 30), log("b", "j2", "2026-10-12T08:00:00", 30)]));
    expect(p.overtimeHours).toBe(0);
    expect(p.grossPay).toBe(1200);
  });

  it("earns commission once per job across multiple clock-ins", () => {
    const p = computeTechPay(tech("COMMISSION", [log("a", "j1", "2026-10-05T08:00:00", 2, 1000), log("b", "j1", "2026-10-06T08:00:00", 3, 1000)]));
    expect(p.grossPay).toBe(100);
    expect(p.totalJobs).toBe(1);
  });

  it("ignores open time logs", () => {
    const open = { ...log("a", "j1", "2026-10-05T08:00:00", 1), clockedOut: null };
    const p = computeTechPay(tech("HOURLY", [open]));
    expect(p.totalHours).toBe(0);
    expect(p.grossPay).toBe(0);
  });
});
