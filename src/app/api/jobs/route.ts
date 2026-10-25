import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { generateJobNumber } from "@/lib/utils";
import { z } from "zod";
import { AuditAction, JobStatus } from "@prisma/client";

const createSchema = z.object({
  customerId: z.string(),
  vehicleId: z.string(),
  technicianId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  serviceLocation: z.string().optional(),
  scheduledAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid scheduledAt").optional(),
  estimatedHours: z.number().nonnegative().optional(),
  mileageIn: z.number().int().nonnegative().optional(),
  internalNotes: z.string().optional(),
  customerNotes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const technicianId = searchParams.get("technicianId");
  const customerId = searchParams.get("customerId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25") || 25));
  const skip = (page - 1) * limit;

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const vehicleId = searchParams.get("vehicleId");

  const where: Record<string, unknown> = {};
  if (status) {
    const validStatuses = new Set<string>(Object.values(JobStatus));
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    const invalid = statuses.filter(s => !validStatuses.has(s));
    if (invalid.length) {
      return apiError(`Invalid status value(s): ${invalid.join(", ")}`, 400);
    }
    where.status = statuses.length > 1 ? { in: statuses as JobStatus[] } : statuses[0];
  }
  // A technician's job list must only contain their own jobs. The UI also
  // filters client-side, but the API must not send other technicians' customer
  // and vehicle data in the first place.
  if (session!.user.role === "TECHNICIAN") {
    where.technicianId = session!.user.id;
  } else if (technicianId) {
    where.technicianId = technicianId;
  }
  if (customerId) where.customerId = customerId;
  if (vehicleId) where.vehicleId = vehicleId;
  if (from || to) {
    where.scheduledAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lt: new Date(to) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { jobNumber: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      { vehicle: { vin: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vehicle: { select: { id: true, year: true, make: true, model: true, plate: true } },
        technician: { select: { id: true, name: true } },
        quote: { select: { id: true, totalAmount: true, status: true } },
        invoice: { select: { id: true, totalAmount: true, amountDue: true, status: true } },
        _count: { select: { parts: true, photos: true } },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  return apiSuccess({ jobs, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  // Verify the vehicle actually belongs to the selected customer. Without
  // this, a typo or a crafted request links customer A to customer B's car.
  const [customer, vehicle, technician] = await Promise.all([
    prisma.customer.findUnique({ where: { id: parsed.data.customerId }, select: { id: true } }),
    prisma.vehicle.findUnique({ where: { id: parsed.data.vehicleId }, select: { id: true, customerId: true } }),
    parsed.data.technicianId
      ? prisma.user.findUnique({ where: { id: parsed.data.technicianId }, select: { id: true, role: true, isActive: true } })
      : Promise.resolve(null),
  ]);
  if (!customer) return apiError("Customer not found", 404);
  if (!vehicle) return apiError("Vehicle not found", 404);
  if (vehicle.customerId !== customer.id) {
    return apiError("Selected vehicle does not belong to the selected customer", 400);
  }
  if (parsed.data.technicianId && (!technician || !technician.isActive || !["TECHNICIAN", "ADMIN"].includes(technician.role))) {
    return apiError("Selected technician is not an active technician", 400);
  }

  const jobNumber = generateJobNumber();

  const job = await prisma.job.create({
    data: {
      ...parsed.data,
      customerId: customer.id,
      vehicleId: vehicle.id,
      jobNumber,
      createdById: session!.user.id,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    },
    include: {
      customer: true,
      vehicle: true,
    },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "Job", job.id, null, job);

  return apiSuccess(job, 201);
}
