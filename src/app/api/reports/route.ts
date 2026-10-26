import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const { error } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const shopId = new URL(req.url).searchParams.get("shopId") || null;
  const jobScope = shopId ? { shopId } : {};
  const invScope = shopId ? { job: { shopId } } : {};
  const payScope = shopId ? { invoice: { job: { shopId } } } : {};

  const now = new Date();
  const start30 = new Date(now); start30.setDate(now.getDate() - 30);
  const start90 = new Date(now); start90.setDate(now.getDate() - 90);
  const startYear = new Date(now.getFullYear(), 0, 1);

  // Revenue by month (last 12 months)
  const payments = await prisma.payment.findMany({
    where: { receivedAt: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) }, ...payScope },
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
    prisma.payment.aggregate({ where: { receivedAt: { gte: start30 }, ...payScope }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: start90 }, ...payScope }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: startYear }, ...payScope }, _sum: { amount: true } }),
    prisma.job.count({ where: { status: { in: ["COMPLETED", "PAID"] }, completedAt: { gte: start30 }, ...jobScope } }),
    prisma.invoice.aggregate({ where: { status: "PAID", ...invScope }, _avg: { totalAmount: true } }),
    prisma.customer.findMany({
      where: { isActive: true },
      include: {
        invoices: { where: { status: { in: ["PAID", "PARTIAL"] }, ...invScope }, select: { amountPaid: true } },
        _count: { select: { jobs: true } },
      },
    }),
    prisma.job.groupBy({ by: ["status"], where: jobScope, _count: { id: true } }),
    prisma.invoice.groupBy({ by: ["status"], where: invScope, _count: { id: true }, _sum: { amountDue: true } }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.customer.count({ where: { createdAt: { gte: start30 } } }),
    prisma.invoice.aggregate({ where: { status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] }, ...invScope }, _sum: { amountDue: true } }),
    prisma.lineItem.groupBy({ by: ["description"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
    prisma.jobPart.groupBy({ by: ["status"], _count: { id: true } }),
    // Technician performance
    prisma.user.findMany({
      where: { role: "TECHNICIAN", isActive: true },
      include: {
        jobs: {
          where: { status: { in: ["COMPLETED", "INVOICED", "PAID"] }, ...jobScope },
          include: {
            invoice: { select: { amountPaid: true, status: true } },
            timeLogs: { select: { clockedIn: true, clockedOut: true } },
          },
        },
        timeLogs: {
          where: { clockedIn: { gte: start30 } },
          select: { clockedIn: true, clockedOut: true },
        },
      },
    }),
    // Gross profit uses collected cash: any invoice with money received,
    // including partially paid and overdue-with-partial-payment invoices.
    prisma.invoice.findMany({
      where: {
        status: { in: ["PAID", "PARTIAL", "OVERDUE"] },
        amountPaid: { gt: 0 },
        updatedAt: { gte: start30 },
        ...invScope,
      },
      select: {
        amountPaid: true,
        totalAmount: true,
        taxAmount: true,
        job: { select: { parts: { select: { totalCost: true } } } },
      },
    }),
  ]);

  // GP by line item type (labor vs parts vs other)
  const lineItemsByType = await prisma.lineItem.groupBy({
    by: ["type"],
    where: { invoice: { status: "PAID", updatedAt: { gte: start30 }, ...invScope } },
    _sum: { total: true },
    _count: { id: true },
  });

  const topCustomersByRevenue = topCustomers
    .map((c) => ({
      name: `${c.firstName} ${c.lastName}`,
      revenue: c.invoices.reduce((s, i) => s + Number(i.amountPaid), 0),
      jobs: c._count.jobs,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Technician scorecards
  const techScores = technicianJobs.map((tech) => {
    const completedJobs = tech.jobs.length;
    const revenue = tech.jobs.reduce((s, j) => s + (j.invoice ? Number(j.invoice.amountPaid) : 0), 0);

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
      // Collected revenue, not invoiced total: a partial payment must not be
      // reported as if the whole invoice was paid.
      // Parts cost is matched to the collected share so a 50% payment carries 50% of COGS.
      const paid = Number(inv.amountPaid);
      const total = Number(inv.totalAmount);
      const collectedShare = total > 0 ? Math.min(paid / total, 1) : 1;
      // Sales tax collected is owed to the state, not profit.
      const revenue = paid - Number(inv.taxAmount ?? 0) * collectedShare;
      const partsCost = (inv.job?.parts || []).reduce((s, p) => s + (p.totalCost ? Number(p.totalCost) : 0), 0);
      const cogs = partsCost * collectedShare;
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

  const range = await customRange(new URL(req.url).searchParams, payScope, jobScope, invScope);

  return apiSuccess({
    range,
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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD totals (local days, inclusive).
async function customRange(
  params: URLSearchParams,
  payScope: object,
  jobScope: object,
  invScope: object,
) {
  const fromParam = params.get("from");
  const toParam = params.get("to");
  if (!fromParam || !toParam || !DATE_ONLY.test(fromParam) || !DATE_ONLY.test(toParam)) return null;
  const from = new Date(`${fromParam}T00:00:00`);
  const to = new Date(`${toParam}T23:59:59.999`);
  if (from > to) return null;

  const [revenue, paymentCount, jobsCompleted, invoices, newCustomers] = await Promise.all([
    prisma.payment.aggregate({ where: { receivedAt: { gte: from, lte: to }, ...payScope }, _sum: { amount: true } }),
    prisma.payment.count({ where: { receivedAt: { gte: from, lte: to }, ...payScope } }),
    prisma.job.count({ where: { status: { in: ["COMPLETED", "PAID"] }, completedAt: { gte: from, lte: to }, ...jobScope } }),
    prisma.invoice.aggregate({
      where: { createdAt: { gte: from, lte: to }, status: { not: "VOID" }, ...invScope },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);

  return {
    from: fromParam,
    to: toParam,
    revenue: Number(revenue._sum.amount ?? 0),
    paymentCount,
    jobsCompleted,
    invoicesIssued: invoices._count.id,
    invoicedTotal: Number(invoices._sum.totalAmount ?? 0),
    newCustomers,
  };
}
