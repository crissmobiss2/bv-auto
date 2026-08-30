import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  const { error, shopId } = await requireShop(["ADMIN", "ACCOUNTANT", "DISPATCHER"]);
  if (error) return error;

  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(now.getDate() - 30);

  const technicians = await prisma.user.findMany({
    where: { role: "TECHNICIAN", isActive: true, shopId },
    select: {
      id: true,
      name: true,
      email: true,
      jobs: {
        select: {
          id: true,
          status: true,
          completedAt: true,
          requiresReturn: true,
          invoice: { select: { totalAmount: true } },
          timeLogs: { select: { clockedIn: true, clockedOut: true } },
        },
      },
      timeLogs: {
        where: { clockedIn: { gte: start30 } },
        select: { clockedIn: true, clockedOut: true },
      },
    },
  });

  const result = technicians.map((tech) => {
    const completed = tech.jobs.filter(j =>
      ["COMPLETED", "INVOICED", "PAID"].includes(j.status)
    );
    const completed30d = completed.filter(j =>
      j.completedAt && j.completedAt >= start30
    );

    const totalRevenue = completed.reduce((sum, j) =>
      sum + Number(j.invoice?.totalAmount || 0), 0
    );
    const revenue30d = completed30d.reduce((sum, j) =>
      sum + Number(j.invoice?.totalAmount || 0), 0
    );
    const avgJobValue = completed.length > 0 ? totalRevenue / completed.length : 0;

    // Hours logged in last 30 days
    const hoursWorked30d = tech.timeLogs.reduce((sum, log) => {
      if (!log.clockedOut) return sum;
      return sum + (log.clockedOut.getTime() - log.clockedIn.getTime()) / 3_600_000;
    }, 0);

    // Avg hours per job (all time logs on completed jobs)
    const allJobHours = completed.flatMap(j => j.timeLogs);
    const totalJobHours = allJobHours.reduce((sum, log) => {
      if (!log.clockedOut) return sum;
      return sum + (log.clockedOut.getTime() - log.clockedIn.getTime()) / 3_600_000;
    }, 0);
    const avgHoursPerJob = completed.length > 0 ? totalJobHours / completed.length : 0;

    // Comebacks = jobs flagged requiresReturn
    const comebacks = completed.filter(j => j.requiresReturn).length;

    // Utilization: hours worked / available hours (8h/day × 22 working days)
    const availableHours = 8 * 22;
    const utilization = (hoursWorked30d / availableHours) * 100;

    return {
      id: tech.id,
      name: tech.name || "Unknown",
      email: tech.email,
      jobsCompleted: completed.length,
      jobsCompleted30d: completed30d.length,
      avgJobValue: Math.round(avgJobValue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenue30d: Math.round(revenue30d * 100) / 100,
      hoursWorked30d: Math.round(hoursWorked30d * 10) / 10,
      avgHoursPerJob: Math.round(avgHoursPerJob * 10) / 10,
      comebacks,
      utilization: Math.round(utilization * 10) / 10,
    };
  });

  // Sort by revenue in last 30 days descending
  result.sort((a, b) => b.revenue30d - a.revenue30d);

  return apiSuccess({ technicians: result });
}
