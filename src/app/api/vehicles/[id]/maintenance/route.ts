import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const intervalSchema = z.object({
  serviceName: z.string().min(1),
  intervalMiles: z.number().int().optional(),
  intervalDays: z.number().int().optional(),
  lastServiceMiles: z.number().int().optional(),
  lastServiceDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const intervals = await prisma.maintenanceInterval.findMany({
    where: { vehicleId: id },
    orderBy: { serviceName: "asc" },
  });

  return apiSuccess(intervals);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = intervalSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid data", 400);

  const data = parsed.data;
  const lastDate = data.lastServiceDate ? new Date(data.lastServiceDate) : null;

  let nextDueMiles: number | undefined;
  let nextDueDate: Date | undefined;

  if (data.intervalMiles && data.lastServiceMiles) {
    nextDueMiles = data.lastServiceMiles + data.intervalMiles;
  }
  if (data.intervalDays && lastDate) {
    nextDueDate = new Date(lastDate.getTime() + data.intervalDays * 86400000);
  }

  const interval = await prisma.maintenanceInterval.create({
    data: {
      vehicleId: id,
      serviceName: data.serviceName,
      intervalMiles: data.intervalMiles ?? null,
      intervalDays: data.intervalDays ?? null,
      lastServiceMiles: data.lastServiceMiles ?? null,
      lastServiceDate: lastDate,
      nextDueMiles: nextDueMiles ?? null,
      nextDueDate: nextDueDate ?? null,
      notes: data.notes || null,
    },
  });

  return apiSuccess(interval, 201);
}
