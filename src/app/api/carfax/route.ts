import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, CarfaxStatus } from "@prisma/client";
import { z } from "zod";

const exportSchema = z.object({
  vehicleId: z.string(),
  jobId: z.string(),
  vin: z.string().min(17).max(17),
  serviceDate: z.string(),
  mileage: z.number().optional(),
  services: z.array(z.object({
    code: z.string(),
    description: z.string(),
    laborHours: z.number().optional(),
    parts: z.array(z.object({ partNumber: z.string().optional(), description: z.string() })).optional(),
  })),
  technicianName: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const vehicleId = req.nextUrl.searchParams.get("vehicleId");
  const where: Record<string, unknown> = { vehicle: { shopId } };
  if (vehicleId) where.vehicleId = vehicleId;

  const records = await prisma.carfaxRecord.findMany({
    where,
    include: { vehicle: true, job: true },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(records);
}

export async function POST(req: NextRequest) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json();
  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: parsed.data.vehicleId, shopId },
    select: { id: true },
  });
  if (!vehicle) return apiError("Vehicle not found", 404);

  // Build the CARFAX-compatible export payload
  const exportPayload = {
    reportType: "SERVICE_HISTORY",
    vin: parsed.data.vin,
    serviceDate: parsed.data.serviceDate,
    mileage: parsed.data.mileage,
    shopName: "B&V Mobile Auto",
    services: parsed.data.services,
    technician: parsed.data.technicianName,
    notes: parsed.data.notes,
    exportedAt: new Date().toISOString(),
  };

  // Actually transmit to CARFAX when configured. Otherwise the record is saved
  // locally and clearly marked NOT transmitted — never falsely reported as sent.
  const apiKey = process.env.CARFAX_API_KEY;
  const apiUrl = process.env.CARFAX_API_URL;
  let status: CarfaxStatus = CarfaxStatus.PENDING;
  let transmitted = false;

  if (apiKey && apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/service-history`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(exportPayload),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        status = CarfaxStatus.SUBMITTED;
        transmitted = true;
      } else {
        status = CarfaxStatus.REJECTED;
      }
    } catch {
      status = CarfaxStatus.PENDING; // network/timeout — keep for retry
    }
  }

  const record = await prisma.carfaxRecord.create({
    data: {
      vehicleId: parsed.data.vehicleId,
      vin: parsed.data.vin,
      serviceHistoryId: parsed.data.jobId,
      exportPayload,
      status,
      exportedAt: transmitted ? new Date() : null,
    },
  });

  await logAudit(
    session!.user.id,
    AuditAction.EXPORT,
    "CarfaxRecord",
    record.id,
    null,
    { vin: parsed.data.vin, jobId: parsed.data.jobId, transmitted }
  );

  return apiSuccess({
    record,
    transmitted,
    status: status.toLowerCase(),
    message: transmitted
      ? "Service history submitted to CARFAX."
      : "Saved locally — NOT yet transmitted to CARFAX (integration not configured).",
  }, 201);
}
