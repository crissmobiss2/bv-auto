import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; intervalId: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { intervalId } = await params;
  const body = await req.json();
  const { serviceName, intervalMiles, intervalDays, lastServiceMiles, lastServiceDate, notes } = body;

  const lastDate = lastServiceDate ? new Date(lastServiceDate) : undefined;
  let nextDueMiles: number | undefined;
  let nextDueDate: Date | undefined;

  if (intervalMiles && lastServiceMiles) nextDueMiles = lastServiceMiles + intervalMiles;
  if (intervalDays && lastDate) nextDueDate = new Date(lastDate.getTime() + intervalDays * 86400000);

  const interval = await prisma.maintenanceInterval.update({
    where: { id: intervalId },
    data: {
      ...(serviceName && { serviceName }),
      ...(intervalMiles !== undefined && { intervalMiles }),
      ...(intervalDays !== undefined && { intervalDays }),
      ...(lastServiceMiles !== undefined && { lastServiceMiles, nextDueMiles: nextDueMiles ?? null }),
      ...(lastDate && { lastServiceDate: lastDate, nextDueDate: nextDueDate ?? null }),
      ...(notes !== undefined && { notes }),
    },
  });

  return apiSuccess(interval);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; intervalId: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { intervalId } = await params;
  await prisma.maintenanceInterval.delete({ where: { id: intervalId } });
  return apiSuccess({ deleted: true });
}
