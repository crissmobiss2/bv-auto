import { requireAuth, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const now = new Date();
  const cutoff90 = new Date(now.getTime() - 90 * 86400000);
  const cutoff365 = new Date(now.getTime() - 365 * 86400000);

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    include: {
      invoices: { where: { status: "PAID" }, select: { totalAmount: true, paidAt: true } },
      jobs: { select: { id: true, createdAt: true, status: true } },
    },
  });

  const scored = customers.map(c => {
    const paidInvoices = c.invoices.filter(i => i.paidAt);
    const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const visitCount = paidInvoices.length;
    const avgTicket = visitCount > 0 ? totalRevenue / visitCount : 0;

    const lastVisit = paidInvoices.length > 0
      ? new Date(Math.max(...paidInvoices.map(i => new Date(i.paidAt!).getTime())))
      : null;

    const daysSinceLast = lastVisit ? (now.getTime() - lastVisit.getTime()) / 86400000 : 9999;
    const visits90 = paidInvoices.filter(i => i.paidAt && new Date(i.paidAt) >= cutoff90).length;
    const visits365 = paidInvoices.filter(i => i.paidAt && new Date(i.paidAt) >= cutoff365).length;

    // RFM scoring: Recency (40%), Frequency (30%), Monetary (30%)
    const recencyScore = daysSinceLast <= 30 ? 100 : daysSinceLast <= 90 ? 75 : daysSinceLast <= 180 ? 50 : daysSinceLast <= 365 ? 25 : 5;
    const freqScore = visits365 >= 4 ? 100 : visits365 === 3 ? 75 : visits365 === 2 ? 50 : visits365 === 1 ? 30 : 0;
    const monetaryScore = totalRevenue >= 2000 ? 100 : totalRevenue >= 1000 ? 75 : totalRevenue >= 500 ? 50 : totalRevenue >= 200 ? 30 : totalRevenue > 0 ? 15 : 0;

    const clvScore = Math.round(recencyScore * 0.4 + freqScore * 0.3 + monetaryScore * 0.3);
    const tier = clvScore >= 75 ? "VIP" : clvScore >= 50 ? "LOYAL" : clvScore >= 25 ? "REGULAR" : daysSinceLast > 180 ? "AT_RISK" : "NEW";

    // Projected 12-month value based on avg frequency and ticket
    const visitFreqPerYear = visits365 || 0.5;
    const projected12m = Math.round(visitFreqPerYear * avgTicket);

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      totalRevenue: Math.round(totalRevenue),
      visitCount,
      avgTicket: Math.round(avgTicket),
      lastVisit,
      daysSinceLast: Math.round(daysSinceLast),
      visits90,
      visits365,
      clvScore,
      tier,
      projected12m,
      isAtRisk: tier === "AT_RISK",
      isVip: tier === "VIP",
    };
  });

  scored.sort((a, b) => b.clvScore - a.clvScore);

  const vipCount = scored.filter(c => c.tier === "VIP").length;
  const atRiskCount = scored.filter(c => c.tier === "AT_RISK").length;
  const totalRevenue = scored.reduce((s, c) => s + c.totalRevenue, 0);
  const topCustomers = scored.slice(0, 5);

  return apiSuccess({ customers: scored, stats: { vipCount, atRiskCount, totalRevenue, topCustomers } });
}
