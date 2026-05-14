import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api-helpers";

// POST /api/tracking/location — technician posts their GPS location
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json() as {
    lat: unknown;
    lng: unknown;
    accuracy?: unknown;
    heading?: unknown;
    speed?: unknown;
    jobId?: unknown;
  };

  const lat = typeof body.lat === "number" ? body.lat : parseFloat(String(body.lat));
  const lng = typeof body.lng === "number" ? body.lng : parseFloat(String(body.lng));

  if (isNaN(lat) || isNaN(lng)) {
    return apiError("lat and lng are required numbers");
  }

  const accuracy  = typeof body.accuracy  === "number" ? body.accuracy  : undefined;
  const heading   = typeof body.heading   === "number" ? body.heading   : undefined;
  const speed     = typeof body.speed     === "number" ? body.speed     : undefined;
  const jobId     = typeof body.jobId     === "string" && body.jobId ? body.jobId : null;

  const userId = session!.user.id;

  await prisma.technicianLocation.create({
    data: { userId, jobId, lat, lng, accuracy, heading, speed },
  });

  // Keep only the most recent 100 locations per user — delete the rest
  const locations = await prisma.technicianLocation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    skip: 100,
  });

  if (locations.length > 0) {
    await prisma.technicianLocation.deleteMany({
      where: { id: { in: locations.map((l) => l.id) } },
    });
  }

  return NextResponse.json({ ok: true });
}

// GET /api/tracking/location — admin/dispatcher sees all active technician locations
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const since = new Date(Date.now() - 5 * 60 * 1000); // last 5 minutes

  const locations = await prisma.technicianLocation.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  // Group by userId, most recent first (already sorted desc above)
  const grouped = new Map<string, {
    userId: string;
    name: string | null;
    locations: Array<{
      id: string;
      lat: number;
      lng: number;
      accuracy: number | null;
      heading: number | null;
      speed: number | null;
      createdAt: Date;
      jobId: string | null;
    }>;
  }>();

  for (const loc of locations) {
    const existing = grouped.get(loc.userId);
    const entry = {
      id: loc.id,
      lat: loc.lat,
      lng: loc.lng,
      accuracy: loc.accuracy,
      heading: loc.heading,
      speed: loc.speed,
      createdAt: loc.createdAt,
      jobId: loc.jobId,
    };
    if (existing) {
      existing.locations.push(entry);
    } else {
      grouped.set(loc.userId, {
        userId: loc.userId,
        name: loc.user.name,
        locations: [entry],
      });
    }
  }

  return NextResponse.json(Array.from(grouped.values()));
}
