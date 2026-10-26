import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { normalizeVin, vinError } from "@/lib/vin";

const updateSchema = z.object({
  vin: z.string().max(32).optional(),
  plate: z.string().max(16).optional(),
  plateState: z.string().max(2).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
  engine: z.string().optional(),
  transmission: z.string().optional(),
  driveType: z.string().optional(),
  fuelType: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
}).partial();

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      customer: true,
      jobs: {
        include: { quote: true, invoice: true },
        orderBy: { createdAt: "desc" },
      },
      carfaxRecords: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!vehicle) return apiError("Vehicle not found", 404);
  return apiSuccess(vehicle);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) return apiError("Vehicle not found", 404);

  const data: Omit<typeof parsed.data, "vin"> & { vin?: string | null } = { ...parsed.data };
  if (parsed.data.vin !== undefined) {
    const vin = normalizeVin(parsed.data.vin);
    data.vin = vin || null;
    if (vin) {
      const vinMsg = vinError(vin, parsed.data.year ?? existing.year);
      if (vinMsg) return apiError(vinMsg, 400);
    }
  }

  const updated = await prisma.vehicle.update({ where: { id }, data });
  await logAudit(session!.user.id, AuditAction.UPDATE, "Vehicle", id, existing, updated);

  return apiSuccess(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) return apiError("Vehicle not found", 404);

  const updated = await prisma.vehicle.update({ where: { id }, data: { isActive: false } });
  await logAudit(session!.user.id, AuditAction.DELETE, "Vehicle", id, existing, updated);

  return apiSuccess({ deleted: true });
}
