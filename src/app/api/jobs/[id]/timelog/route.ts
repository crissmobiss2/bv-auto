import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const logs = await prisma.timeLog.findMany({
    where: { jobId: id },
    orderBy: { clockedIn: "asc" },
    include: { technician: { select: { id: true, name: true } } },
  });

  const totalMinutes = logs.reduce((sum, l) => {
    if (!l.clockedOut) return sum;
    return sum + Math.round((l.clockedOut.getTime() - l.clockedIn.getTime()) / 60000);
  }, 0);

  return apiSuccess({ logs, totalMinutes });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { action, logId, notes, lat, lng } = await req.json();

  if (action === "clock-in") {
    const open = await prisma.timeLog.findFirst({
      where: { jobId: id, technicianId: session!.user.id, clockedOut: null },
    });
    if (open) return apiError("Already clocked in", 400);

    const log = await prisma.timeLog.create({
      data: {
        jobId: id,
        technicianId: session!.user.id,
        notes: notes || null,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
      },
      include: { technician: { select: { id: true, name: true } } },
    });
    return apiSuccess(log, 201);
  }

  if (action === "clock-out") {
    if (!logId) return apiError("logId required", 400);
    const log = await prisma.timeLog.update({
      where: { id: logId },
      data: { clockedOut: new Date(), ...(notes && { notes }) },
      include: { technician: { select: { id: true, name: true } } },
    });
    return apiSuccess(log);
  }

  return apiError("Invalid action", 400);
}
