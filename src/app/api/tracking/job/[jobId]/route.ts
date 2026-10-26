import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getIP } from "@/lib/rate-limit";

// GET /api/tracking/job/[jobId] — public endpoint for customer to track their technician
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!(await rateLimit(`track:${getIP(req)}`, 60, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
        // Deliberately omit customer PII: the tracking link is public.
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
      technician: job.technician ? { name: job.technician.name } : null,
    },
    eta: null,
  });
}
