import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, shopId } });
  if (!job) return apiError("Job not found", 404);

  const declined = await prisma.declinedService.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
  });
  return apiSuccess(declined);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const job = await prisma.job.findFirst({ where: { id, shopId }, select: { customerId: true, vehicleId: true } });
  if (!job) return apiError("Job not found", 404);

  if (!body.description) return apiError("description is required", 400);

  const declined = await prisma.declinedService.create({
    data: {
      jobId: id,
      customerId: job.customerId,
      vehicleId: job.vehicleId,
      description: body.description,
      reason: body.reason || undefined,
      estimatedPrice: body.estimatedPrice ? parseFloat(body.estimatedPrice) : undefined,
      followUpAt: body.followUpAt ? new Date(body.followUpAt) : undefined,
    },
  });
  return apiSuccess(declined, 201);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, shopId } });
  if (!job) return apiError("Job not found", 404);

  const { searchParams } = req.nextUrl;
  const declinedId = searchParams.get("declinedId");
  if (!declinedId) return apiError("declinedId required", 400);

  const body = await req.json();
  const updated = await prisma.declinedService.update({
    where: { id: declinedId, jobId: id },
    data: {
      followedUp: body.followedUp,
      followUpNote: body.followUpNote,
    },
  });
  return apiSuccess(updated);
}
