import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

// GET /api/tracking/job/[jobId] — live technician tracking.
// Restricted to staff of the job's shop or the customer who owns the job.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

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
        shopId: true,
        customerId: true,
        customer: { select: { firstName: true, lastName: true } },
        technician: { select: { name: true } },
      },
    }),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Ownership check: staff must share the shop; a customer must own the job.
  const u = session!.user;
  const allowed =
    u.role === "CUSTOMER"
      ? await prisma.user.findUnique({ where: { id: u.id }, select: { customerId: true } })
          .then((me) => !!me?.customerId && me.customerId === job.customerId)
      : !!u.shopId && u.shopId === job.shopId;
  if (!allowed) {
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
