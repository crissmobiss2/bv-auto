import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  customerId: z.string(),
  jobId: z.string().optional(),
  title: z.string().min(1),
  notes: z.string().optional(),
  dueAt: z.string(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const customerId = searchParams.get("customerId");
  const upcoming = searchParams.get("upcoming") === "true";

  const where: Record<string, unknown> = { isCompleted: false };
  if (customerId) where.customerId = customerId;
  if (upcoming) where.dueAt = { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) };

  const followUps = await prisma.followUp.findMany({
    where,
    include: { customer: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { dueAt: "asc" },
    take: 50,
  });

  return apiSuccess(followUps);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const followUp = await prisma.followUp.create({
    data: {
      ...parsed.data,
      dueAt: new Date(parsed.data.dueAt),
    },
  });

  return apiSuccess(followUp, 201);
}
