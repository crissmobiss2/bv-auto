import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const parts = await prisma.jobPart.findMany({
    where: { job: { shopId }, createdAt: { gte: since }, totalCost: { gt: 0 }, totalPrice: { gt: 0 } },
    select: {
      id: true,
      description: true,
      partNumber: true,
      quantity: true,
      unitCost: true,
      unitPrice: true,
      totalCost: true,
      totalPrice: true,
      markup: true,
      createdAt: true,
      vendor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (!parts.length) return apiSuccess({ summary: null, topMargin: [], lowMargin: [], byVendor: [] });

  const totalCost = parts.reduce((s, p) => s + Number(p.totalCost), 0);
  const totalRevenue = parts.reduce((s, p) => s + Number(p.totalPrice), 0);
  const avgMarginPct = totalCost > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 0;

  const enriched = parts.map((p) => {
    const cost = Number(p.totalCost);
    const price = Number(p.totalPrice);
    const profit = price - cost;
    const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0;
    return { ...p, profit, marginPct };
  });

  enriched.sort((a, b) => b.marginPct - a.marginPct);
  const topMargin = enriched.slice(0, 10);
  const lowMargin = [...enriched].sort((a, b) => a.marginPct - b.marginPct).slice(0, 10);

  const vendorMap: Record<string, { name: string; revenue: number; cost: number; count: number }> = {};
  for (const p of enriched) {
    const vName = p.vendor?.name || "No Vendor";
    if (!vendorMap[vName]) vendorMap[vName] = { name: vName, revenue: 0, cost: 0, count: 0 };
    vendorMap[vName].revenue += Number(p.totalPrice);
    vendorMap[vName].cost += Number(p.totalCost);
    vendorMap[vName].count += 1;
  }
  const byVendor = Object.values(vendorMap).map((v) => ({
    ...v,
    marginPct: v.revenue > 0 ? Math.round(((v.revenue - v.cost) / v.revenue) * 100) : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  return apiSuccess({
    summary: {
      totalRevenue: Math.round(totalRevenue),
      totalCost: Math.round(totalCost),
      totalProfit: Math.round(totalRevenue - totalCost),
      avgMarginPct,
      partCount: parts.length,
    },
    topMargin,
    lowMargin,
    byVendor,
  });
}
