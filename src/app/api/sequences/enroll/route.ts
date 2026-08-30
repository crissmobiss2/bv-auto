import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff, apiError, apiSuccess } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const { sequenceId, customerId, jobId } = await req.json();
  if (!sequenceId || !customerId) return apiError("sequenceId and customerId required");

  const sequence = await prisma.commSequence.findUnique({
    where: { id: sequenceId },
    include: { steps: { orderBy: { stepNumber: "asc" }, take: 1 } },
  });
  if (!sequence) return apiError("Sequence not found");

  // Check if already enrolled
  const existing = await prisma.commEnrollment.findFirst({
    where: { sequenceId, customerId, status: "ACTIVE" },
  });
  if (existing) return apiSuccess({ alreadyEnrolled: true, enrollment: existing });

  const firstStep = sequence.steps[0];
  const nextStepAt = firstStep
    ? new Date(Date.now() + (firstStep.delayHours || 0) * 3600000)
    : null;

  const enrollment = await prisma.commEnrollment.create({
    data: { sequenceId, customerId, jobId, nextStepAt },
  });

  return apiSuccess(enrollment, 201);
}
