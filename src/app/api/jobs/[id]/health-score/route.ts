import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError } from "@/lib/api-helpers";

// Compute vehicle health score (0-100) from inspection checklist data.
// NOTE: inspection items are stored with a `condition` field (GOOD/FAIR/…),
// not `grade` — reading the wrong key made every score come back 0.
export function computeHealthScore(checklist: {
  items?: Array<{ condition?: string; category?: string }>;
}): { score: number; summary: string; breakdown: Record<string, number> } {
  const items = checklist?.items || [];
  if (items.length === 0) return { score: 0, summary: "No inspection data", breakdown: {} };

  const conditionWeight: Record<string, number> = {
    GOOD: 100, FAIR: 60, NEEDS_ATTENTION: 25, CRITICAL: 0, NA: -1,
  };

  const gradeable = items.filter(i => i.condition && i.condition !== "NA");
  if (gradeable.length === 0) return { score: 0, summary: "No graded items", breakdown: {} };

  const byCategory: Record<string, { total: number; count: number }> = {};
  for (const item of gradeable) {
    const cat = item.category || "General";
    const w = conditionWeight[item.condition!] ?? 50;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
    byCategory[cat].total += w;
    byCategory[cat].count += 1;
  }

  const breakdown: Record<string, number> = {};
  let totalScore = 0;
  let catCount = 0;
  for (const [cat, { total, count }] of Object.entries(byCategory)) {
    const catScore = Math.round(total / count);
    breakdown[cat] = catScore;
    totalScore += catScore;
    catCount++;
  }

  const score = Math.round(totalScore / catCount);

  const criticalCount = items.filter(i => i.condition === "CRITICAL").length;
  const needsCount = items.filter(i => i.condition === "NEEDS_ATTENTION").length;

  let summary = "";
  if (score >= 85) summary = "Vehicle is in great shape";
  else if (score >= 70) summary = `Good overall — ${needsCount} item${needsCount !== 1 ? "s" : ""} need attention`;
  else if (score >= 50) summary = `Fair condition — ${needsCount} items need attention${criticalCount > 0 ? `, ${criticalCount} critical` : ""}`;
  else summary = `Needs service — ${criticalCount} critical issue${criticalCount !== 1 ? "s" : ""}, ${needsCount} attention items`;

  return { score, summary, breakdown };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, shopId },
    select: { id: true, checklist: true, vehicleHealthScore: true, vehicle: { select: { year: true, make: true, model: true } } },
  });
  if (!job) return apiError("Job not found", 404);

  if (!job.checklist) return apiSuccess({ score: null, summary: "No inspection on file" });

  const result = computeHealthScore(job.checklist as Parameters<typeof computeHealthScore>[0]);
  return apiSuccess({ ...result, vehicleHealthScore: job.vehicleHealthScore, vehicle: job.vehicle });
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, shopId },
    select: { id: true, checklist: true, customerId: true, vehicle: { select: { year: true, make: true, model: true } }, customer: { select: { phone: true, firstName: true } } },
  });
  if (!job) return apiError("Job not found", 404);
  if (!job.checklist) return apiError("No inspection data to score");

  const result = computeHealthScore(job.checklist as Parameters<typeof computeHealthScore>[0]);

  await prisma.job.update({ where: { id }, data: { vehicleHealthScore: result.score } });

  return apiSuccess(result);
}
