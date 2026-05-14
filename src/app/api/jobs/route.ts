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
  scheduledAt: z.string().optional(),
  estimatedHours: z.number().optional(),
  mileageIn: z.number().optional(),
  internalNotes: z.string().optional(),
  customerNotes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const technicianId = searchParams.get("technicianId");
  const customerId = searchParams.get("customerId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const skip = (page - 1) * limit;

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const vehicleId = searchParams.get("vehicleId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status as JobStatus;
  if (technicianId) where.technicianId = technicianId;
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

  const jobNumber = generateJobNumber();

  const job = await prisma.job.create({
    data: {
      ...parsed.data,
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
