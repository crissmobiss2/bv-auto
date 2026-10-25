import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, select: { technicianId: true } });
  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only view declined services for jobs assigned to you", 403);
  }
  const declined = await prisma.declinedService.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
  });
  return apiSuccess(declined);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const job = await prisma.job.findUnique({
    where: { id },
    select: { customerId: true, vehicleId: true, technicianId: true },
  });
  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only record declined services for jobs assigned to you", 403);
  }

  if (!body.description || typeof body.description !== "string" || body.description.length > 2000) {
    return apiError("description is required (max 2,000 characters)", 400);
  }
  const estimatedPrice = body.estimatedPrice === undefined ? undefined : Number(body.estimatedPrice);
  if (estimatedPrice !== undefined && (!Number.isFinite(estimatedPrice) || estimatedPrice < 0)) {
    return apiError("estimatedPrice must be a non-negative number", 400);
  }

  const declined = await prisma.declinedService.create({
    data: {
      jobId: id,
      customerId: job.customerId,
      vehicleId: job.vehicleId,
      description: body.description,
      reason: body.reason || undefined,
      estimatedPrice,
      followUpAt: body.followUpAt ? new Date(body.followUpAt) : undefined,
    },
  });
  return apiSuccess(declined, 201);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const declinedId = searchParams.get("declinedId");
  if (!declinedId) return apiError("declinedId required", 400);

  const existing = await prisma.declinedService.findFirst({
    where: { id: declinedId, jobId: id },
    select: { id: true, job: { select: { technicianId: true } } },
  });
  if (!existing) return apiError("Declined service not found for this job", 404);
  if (session!.user.role === "TECHNICIAN" && existing.job.technicianId !== session!.user.id) {
    return apiError("You can only update declined services for jobs assigned to you", 403);
  }

  const body = await req.json();
  const updated = await prisma.declinedService.update({
    where: { id: existing.id },
    data: {
      followedUp: body.followedUp,
      followUpNote: body.followUpNote,
    },
  });
  return apiSuccess(updated);
}
