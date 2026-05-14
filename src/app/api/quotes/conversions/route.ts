import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const now = new Date();
  const start30 = new Date(now); start30.setDate(now.getDate() - 30);
  const start90 = new Date(now); start90.setDate(now.getDate() - 90);

  const [all30, approved30, declined30, all90, approved90, declined90, topDeclined, avgApprovalHours] = await Promise.all([
    prisma.quote.count({ where: { createdAt: { gte: start30 }, status: { not: "DRAFT" } } }),
    prisma.quote.count({ where: { createdAt: { gte: start30 }, status: { in: ["APPROVED", "CONVERTED"] } } }),
    prisma.quote.count({ where: { createdAt: { gte: start30 }, status: "DECLINED" } }),
    prisma.quote.count({ where: { createdAt: { gte: start90 }, status: { not: "DRAFT" } } }),
    prisma.quote.count({ where: { createdAt: { gte: start90 }, status: { in: ["APPROVED", "CONVERTED"] } } }),
    prisma.quote.count({ where: { createdAt: { gte: start90 }, status: "DECLINED" } }),
    // Top declined services by reason/description
    prisma.quote.findMany({
      where: { status: "DECLINED", declineReason: { not: null } },
      select: { declineReason: true, totalAmount: true },
      orderBy: { declinedAt: "desc" },
      take: 50,
    }),
    // Average hours from sent → approved
    prisma.quote.findMany({
      where: { status: { in: ["APPROVED", "CONVERTED"] }, sentAt: { not: null }, approvedAt: { not: null } },
      select: { sentAt: true, approvedAt: true },
      take: 100,
    }),
  ]);

  const approvalRate30 = all30 > 0 ? Math.round((approved30 / all30) * 100) : 0;
  const approvalRate90 = all90 > 0 ? Math.round((approved90 / all90) * 100) : 0;

  // Compute average approval time in hours
  const avgApproval = avgApprovalHours.length > 0
    ? Math.round(avgApprovalHours.reduce((s, q) => {
        const diff = new Date(q.approvedAt!).getTime() - new Date(q.sentAt!).getTime();
        return s + diff / 3600000;
      }, 0) / avgApprovalHours.length)
    : null;

  // Aggregate decline reasons
  const reasonMap: Record<string, number> = {};
  for (const q of topDeclined) {
    const r = q.declineReason || "No reason given";
    reasonMap[r] = (reasonMap[r] || 0) + 1;
  }
  const topReasons = Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));

  // Status funnel (last 90 days)
  const funnel = await prisma.quote.groupBy({
    by: ["status"],
    where: { createdAt: { gte: start90 } },
    _count: { id: true },
  });

  return apiSuccess({
    period30: { sent: all30, approved: approved30, declined: declined30, approvalRate: approvalRate30 },
    period90: { sent: all90, approved: approved90, declined: declined90, approvalRate: approvalRate90 },
    avgApprovalHours: avgApproval,
    topDeclineReasons: topReasons,
    funnel: funnel.map(f => ({ status: f.status, count: f._count.id })),
  });
}
