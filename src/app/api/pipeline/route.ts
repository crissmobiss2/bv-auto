import { requireShop, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, shopId } = await requireShop(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const now = new Date();

  const defaultShop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { laborRate: true },
  });
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in60 = new Date(now.getTime() + 60 * 86400000);
  const in90 = new Date(now.getTime() + 90 * 86400000);

  const [openQuotes, scheduledJobs, activeJobs, fleetAccounts, recentRevenue] = await Promise.all([
    prisma.quote.findMany({
      where: { shopId, status: { in: ["SENT", "DRAFT"] } },
      select: { id: true, totalAmount: true, status: true, createdAt: true, job: { select: { title: true, scheduledAt: true } }, customer: { select: { firstName: true, lastName: true } } },
    }),
    prisma.job.findMany({
      where: { shopId, status: "SCHEDULED", scheduledAt: { gte: now, lte: in90 } },
      select: { id: true, title: true, scheduledAt: true, estimatedHours: true, customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { year: true, make: true, model: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.job.findMany({
      where: { shopId, status: "IN_PROGRESS" },
      select: { id: true, title: true, estimatedHours: true },
    }),
    prisma.fleetAccount.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, creditLimit: true },
    }),
    prisma.invoice.findMany({
      where: { shopId, status: "PAID", paidAt: { gte: new Date(now.getFullYear(), now.getMonth() - 2, 1) } },
      select: { totalAmount: true, paidAt: true },
    }),
  ]);

  // Weight quotes by probability based on status and age
  const weightedQuotes = openQuotes.map(q => {
    const ageDays = (now.getTime() - new Date(q.createdAt).getTime()) / 86400000;
    const baseProbability = q.status === "SENT" ? 0.45 : 0.20;
    const agePenalty = Math.min(ageDays / 30, 1) * 0.2;
    const probability = Math.max(baseProbability - agePenalty, 0.05);
    return { ...q, probability, weightedValue: Number(q.totalAmount) * probability };
  });

  // Monthly revenue for trend
  const monthlyRevenue: Record<string, number> = {};
  for (const inv of recentRevenue) {
    const key = new Date(inv.paidAt!).toISOString().slice(0, 7);
    monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(inv.totalAmount);
  }
  const avgMonthly = Object.values(monthlyRevenue).length > 0
    ? Object.values(monthlyRevenue).reduce((a, b) => a + b, 0) / Object.values(monthlyRevenue).length
    : 0;

  // Labor rate from shop settings, fallback to $105 if shop not configured
  const laborRate = defaultShop?.laborRate ? Number(defaultShop.laborRate) : 105;
  const scheduledRevenue30 = scheduledJobs
    .filter(j => new Date(j.scheduledAt!) <= in30)
    .reduce((s, j) => s + Number(j.estimatedHours || 2) * laborRate, 0);
  const scheduledRevenue60 = scheduledJobs
    .filter(j => new Date(j.scheduledAt!) <= in60)
    .reduce((s, j) => s + Number(j.estimatedHours || 2) * laborRate, 0);
  const scheduledRevenue90 = scheduledJobs
    .filter(j => new Date(j.scheduledAt!) <= in90)
    .reduce((s, j) => s + Number(j.estimatedHours || 2) * laborRate, 0);

  const fleetMonthly = fleetAccounts.reduce((s, f) => s + Number(f.creditLimit || 0), 0);
  const quotePipeline = weightedQuotes.reduce((s, q) => s + q.weightedValue, 0);

  return apiSuccess({
    summary: {
      openQuotes: openQuotes.length,
      quotePipelineValue: Math.round(quotePipeline),
      scheduledJobs30: scheduledJobs.filter(j => new Date(j.scheduledAt!) <= in30).length,
      activeJobs: activeJobs.length,
      fleetMonthlyValue: Math.round(fleetMonthly),
    },
    forecast: {
      days30: Math.round(scheduledRevenue30 + quotePipeline * 0.4 + fleetMonthly),
      days60: Math.round(scheduledRevenue60 + quotePipeline * 0.6 + fleetMonthly * 2),
      days90: Math.round(scheduledRevenue90 + quotePipeline * 0.8 + fleetMonthly * 3 + avgMonthly),
      avgMonthlyRevenue: Math.round(avgMonthly),
    },
    quotes: weightedQuotes.slice(0, 15),
    scheduledJobs: scheduledJobs.slice(0, 20),
    fleetAccounts,
    monthlyTrend: Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) })),
  });
}
