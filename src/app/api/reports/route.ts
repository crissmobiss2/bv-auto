import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const now = new Date();
  const start30 = new Date(now); start30.setDate(now.getDate() - 30);
  const start90 = new Date(now); start90.setDate(now.getDate() - 90);
  const startYear = new Date(now.getFullYear(), 0, 1);

  // Revenue by month (last 12 months)
  const payments = await prisma.payment.findMany({
    where: { receivedAt: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } },
    select: { amount: true, receivedAt: true },
    orderBy: { receivedAt: "asc" },
  });

  const revenueByMonthMap: Record<string, number> = {};
  for (const p of payments) {
    const key = `${p.receivedAt.getFullYear()}-${String(p.receivedAt.getMonth() + 1).padStart(2, "0")}`;
    revenueByMonthMap[key] = (revenueByMonthMap[key] || 0) + Number(p.amount);
  }
  const revenueByMonth = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    revenueByMonth.push({
      month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      revenue: Math.round((revenueByMonthMap[key] || 0) * 100) / 100,
    });
  }

  const [
    revenue30, revenue90, revenueYTD,
    jobsCompleted30, avgJobValue,
    topCustomers, jobsByStatus,
    invoicesByStatus, customerCount, newCustomers30, openInvoiceTotal,
    topServices, partsStats,
    technicianJobs,
    allInvoicesForGP,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { receivedAt: { gte: start30 } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: start90 } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: startYear } }, _sum: { amount: true } }),
    prisma.job.count({ where: { status: { in: ["COMPLETED", "PAID"] }, completedAt: { gte: start30 } } }),
    prisma.invoice.aggregate({ where: { status: "PAID" }, _avg: { totalAmount: true } }),
    prisma.customer.findMany({
      where: { isActive: true },
      include: {
        invoices: { where: { status: "PAID" }, select: { totalAmount: true } },
        _count: { select: { jobs: true } },
      },
    }),
    prisma.job.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.invoice.groupBy({ by: ["status"], _count: { id: true }, _sum: { amountDue: true } }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.customer.count({ where: { createdAt: { gte: start30 } } }),
    prisma.invoice.aggregate({ where: { status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] } }, _sum: { amountDue: true } }),
    prisma.lineItem.groupBy({ by: ["description"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
    prisma.jobPart.groupBy({ by: ["status"], _count: { id: true } }),
    // Technician performance
    prisma.user.findMany({
      where: { role: "TECHNICIAN", isActive: true },
      include: {
        jobs: {
          where: { status: { in: ["COMPLETED", "INVOICED", "PAID"] } },
          include: {
            invoice: { select: { totalAmount: true, status: true } },
            timeLogs: { select: { clockedIn: true, clockedOut: true } },
          },
        },
        timeLogs: {
          where: { clockedIn: { gte: start30 } },
          select: { clockedIn: true, clockedOut: true },
        },
      },
    }),
    // For gross profit calculation — get paid invoices with parts cost
    prisma.invoice.findMany({
      where: { status: "PAID", updatedAt: { gte: start30 } },
      select: {
        totalAmount: true,
        job: { select: { parts: { select: { totalCost: true } } } },
      },
    }),
  ]);

  // GP by line item type (labor vs parts vs other)
  const lineItemsByType = await prisma.lineItem.groupBy({
    by: ["type"],
    where: { invoice: { status: "PAID", updatedAt: { gte: start30 } } },
    _sum: { total: true },
    _count: { id: true },
  });

  const topCustomersByRevenue = topCustomers
    .map((c) => ({
      name: `${c.firstName} ${c.lastName}`,
      revenue: c.invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      jobs: c._count.jobs,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Technician scorecards
  const techScores = technicianJobs.map((tech) => {
    const completedJobs = tech.jobs.length;
    const revenue = tech.jobs.reduce((s, j) => s + (j.invoice ? Number(j.invoice.totalAmount) : 0), 0);

    // Calculate actual hours worked (last 30 days)
    const actualMinutes = tech.timeLogs.reduce((s, log) => {
      if (!log.clockedOut) return s;
      return s + (new Date(log.clockedOut).getTime() - new Date(log.clockedIn).getTime()) / 60000;
    }, 0);
    const actualHours = actualMinutes / 60;

    // Calculate billed hours from all jobs
    const billedHours = tech.jobs.reduce((s, j) => {
      const jobMins = j.timeLogs.reduce((jS, log) => {
        if (!log.clockedOut) return jS;
        return jS + (new Date(log.clockedOut).getTime() - new Date(log.clockedIn).getTime()) / 60000;
      }, 0);
      return s + jobMins / 60;
    }, 0);

    return {
      id: tech.id,
      name: tech.name,
      completedJobs,
      revenue: Math.round(revenue * 100) / 100,
      actualHours: Math.round(actualHours * 10) / 10,
      billedHours: Math.round(billedHours * 10) / 10,
      efficiency: actualHours > 0 ? Math.round((billedHours / actualHours) * 100) : 0,
      avgJobRevenue: completedJobs > 0 ? Math.round((revenue / completedJobs) * 100) / 100 : 0,
    };
  });

  // Gross profit (last 30 days)
  const gpData = allInvoicesForGP.reduce(
    (acc, inv) => {
      const revenue = Number(inv.totalAmount);
      const cogs = (inv.job?.parts || []).reduce((s, p) => s + (p.totalCost ? Number(p.totalCost) : 0), 0);
      acc.revenue += revenue;
      acc.cogs += cogs;
      return acc;
    },
    { revenue: 0, cogs: 0 }
  );
  const gpAmount = gpData.revenue - gpData.cogs;
  const gpPercent = gpData.revenue > 0 ? Math.round((gpAmount / gpData.revenue) * 100) : 0;

  // Customer retention: returning vs new (last 90 days)
  const returningCustomers = await prisma.customer.count({
    where: {
      isActive: true,
      jobs: { some: { createdAt: { lt: start90 } } },
      AND: [{ jobs: { some: { createdAt: { gte: start90 } } } }],
    },
  });

  // Build GP breakdown
  const gpByType = lineItemsByType.map(li => ({
    type: li.type,
    revenue: Math.round(Number(li._sum.total ?? 0) * 100) / 100,
    count: li._count.id,
  })).sort((a, b) => b.revenue - a.revenue);

  return apiSuccess({
    revenueByMonth,
    summary: {
      revenue30: Number(revenue30._sum.amount ?? 0),
      revenue90: Number(revenue90._sum.amount ?? 0),
      revenueYTD: Number(revenueYTD._sum.amount ?? 0),
      jobsCompleted30,
      avgJobValue: Number(avgJobValue._avg?.totalAmount ?? 0),
      customerCount,
      newCustomers30,
      openInvoiceTotal: Number(openInvoiceTotal._sum.amountDue ?? 0),
      gpAmount: Math.round(gpAmount * 100) / 100,
      gpPercent,
      returningCustomers,
    },
    jobsByStatus,
    invoicesByStatus,
    topCustomers: topCustomersByRevenue,
    topServices,
    partsStats,
    techScores,
    gpByType,
  });
}
