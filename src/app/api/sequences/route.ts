import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const sequences = await prisma.commSequence.findMany({
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const active = await prisma.commEnrollment.count({ where: { status: "ACTIVE" } });

  return apiSuccess({ sequences, activeEnrollments: active });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { name, triggerEvent, steps } = await req.json();
  if (!name || !triggerEvent || !steps?.length) return apiError("name, triggerEvent, and steps are required");

  const sequence = await prisma.commSequence.create({
    data: {
      name,
      triggerEvent,
      steps: {
        create: steps.map((s: { stepNumber: number; delayHours: number; messageTemplate: string; channel?: string }) => ({
          stepNumber: s.stepNumber,
          delayHours: s.delayHours || 0,
          messageTemplate: s.messageTemplate,
          channel: s.channel || "SMS",
        })),
      },
    },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  return apiSuccess(sequence, 201);
}
