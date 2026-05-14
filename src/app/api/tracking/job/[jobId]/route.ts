import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tracking/job/[jobId] — public endpoint for customer to track their technician
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const since = new Date(Date.now() - 30 * 60 * 1000); // last 30 minutes

  const [location, job] = await Promise.all([
    prisma.technicianLocation.findFirst({
      where: { jobId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: { lat: true, lng: true, accuracy: true, createdAt: true },
    }),
    prisma.job.findUnique({
      where: { id: jobId },
      select: {
        title: true,
        status: true,
        scheduledAt: true,
        customer: { select: { firstName: true, lastName: true } },
        technician: { select: { name: true } },
      },
    }),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    location: location
      ? {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          createdAt: location.createdAt,
        }
      : null,
    job: {
      title: job.title,
      status: job.status,
      scheduledAt: job.scheduledAt,
      customer: job.customer
        ? { firstName: job.customer.firstName, lastName: job.customer.lastName }
        : null,
      technician: job.technician ? { name: job.technician.name } : null,
    },
    eta: null,
  });
}
