import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, select: { technicianId: true } });
  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only view time logs for jobs assigned to you", 403);
  }

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

  const job = await prisma.job.findUnique({ where: { id }, select: { technicianId: true } });
  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only log time on jobs assigned to you", 403);
  }

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
    await logAudit(session!.user.id, AuditAction.CREATE, "TimeLog", log.id, null, { jobId: id, clockedIn: log.clockedIn });
    return apiSuccess(log, 201);
  }

  if (action === "clock-out") {
    if (!logId) return apiError("logId required", 400);
    const existingLog = await prisma.timeLog.findFirst({
      where: {
        id: String(logId),
        jobId: id,
        clockedOut: null,
        ...(session!.user.role === "TECHNICIAN" ? { technicianId: session!.user.id } : {}),
      },
      select: { id: true },
    });
    if (!existingLog) return apiError("No open time log found for this job (it may already be clocked out)", 404);

    // Conditional on still being open, so a concurrent cancellation's end time is never overwritten.
    const closed = await prisma.timeLog.updateMany({
      where: { id: existingLog.id, clockedOut: null },
      data: { clockedOut: new Date(), ...(notes && { notes }) },
    });
    if (closed.count === 0) return apiError("This time log was already clocked out", 409);
    const log = await prisma.timeLog.findUniqueOrThrow({
      where: { id: existingLog.id },
      include: { technician: { select: { id: true, name: true } } },
    });
    await logAudit(session!.user.id, AuditAction.UPDATE, "TimeLog", log.id, { clockedOut: null }, { jobId: id, clockedIn: log.clockedIn, clockedOut: log.clockedOut });
    return apiSuccess(log);
  }

  return apiError("Invalid action", 400);
}
