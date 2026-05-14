import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
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
  const { error } = await requireAuth();
  if (error) return error;

  const vehicleId = req.nextUrl.searchParams.get("vehicleId");
  const where = vehicleId ? { vehicleId } : {};

  const records = await prisma.carfaxRecord.findMany({
    where,
    include: { vehicle: true, job: true },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(records);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

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

  const record = await prisma.carfaxRecord.create({
    data: {
      vehicleId: parsed.data.vehicleId,
      vin: parsed.data.vin,
      serviceHistoryId: parsed.data.jobId,
      exportPayload,
      status: CarfaxStatus.EXPORTED,
      exportedAt: new Date(),
    },
  });

  // In production: POST to CARFAX API endpoint with exportPayload
  // const apiKey = process.env.CARFAX_API_KEY;
  // const response = await fetch(`${process.env.CARFAX_API_URL}/service-history`, {
  //   method: "POST",
  //   headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
  //   body: JSON.stringify(exportPayload),
  // });

  await logAudit(
    session!.user.id,
    AuditAction.EXPORT,
    "CarfaxRecord",
    record.id,
    null,
    { vin: parsed.data.vin, jobId: parsed.data.jobId }
  );

  return apiSuccess({ record, exportPayload, status: "exported" }, 201);
}
