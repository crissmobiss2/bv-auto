import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit, pick } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";

const VEHICLE_FIELDS = [
  "vin", "plate", "plateState", "year", "make", "model", "trim", "color",
  "mileage", "engine", "transmission", "driveType", "fuelType", "notes", "isActive",
] as const;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, shopId },
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
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.vehicle.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Vehicle not found", 404);

  // Allowlist only — never let a client re-parent (customerId) or move shops.
  const updated = await prisma.vehicle.update({ where: { id }, data: pick(body, VEHICLE_FIELDS) });
  await logAudit(session!.user.id, AuditAction.UPDATE, "Vehicle", id, existing, updated);

  return apiSuccess(updated);
}
