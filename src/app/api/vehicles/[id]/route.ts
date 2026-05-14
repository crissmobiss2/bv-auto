import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";

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

  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) return apiError("Vehicle not found", 404);

  const updated = await prisma.vehicle.update({ where: { id }, data: body });
  await logAudit(session!.user.id, AuditAction.UPDATE, "Vehicle", id, existing, updated);

  return apiSuccess(updated);
}
