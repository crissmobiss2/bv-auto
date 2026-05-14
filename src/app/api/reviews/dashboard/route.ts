import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const [total, sent, clicked, recent] = await Promise.all([
    prisma.reviewRequest.count(),
    prisma.reviewRequest.count({ where: { sentAt: { not: null } } }),
    prisma.reviewRequest.count({ where: { clickedAt: { not: null } } }),
    prisma.reviewRequest.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        job: { select: { jobNumber: true, title: true, vehicle: { select: { year: true, make: true, model: true } } } },
      },
    }),
  ]);

  const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;

  return apiSuccess({ total, sent, clicked, clickRate, recent });
}
