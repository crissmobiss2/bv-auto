import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { z } from "zod";
import { AuditAction } from "@prisma/client";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const createSchema = z.object({
  customerId: z.string().min(1),
  vin: z.string().optional(),
  plate: z.string().optional(),
  plateState: z.string().optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  trim: z.string().optional(),
  color: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
  engine: z.string().optional(),
  transmission: z.string().optional(),
  driveType: z.string().optional(),
  fuelType: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const customerId = searchParams.get("customerId");
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = { isActive: true, shopId };
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { vin: { contains: search, mode: "insensitive" } },
      { plate: { contains: search, mode: "insensitive" } },
      { make: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
    ];
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: { customer: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(vehicles);
}

export async function POST(req: NextRequest) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json();

  // Sanitize: convert empty strings to undefined so Zod/Prisma store null, not ""
  const clean = {
    customerId: body.customerId,
    year: typeof body.year === "string" ? parseInt(body.year) : body.year,
    make: body.make,
    model: body.model,
    vin: str(body.vin),
    plate: str(body.plate),
    plateState: str(body.plateState),
    trim: str(body.trim),
    color: str(body.color),
    mileage: body.mileage ? (typeof body.mileage === "string" ? parseInt(body.mileage) : body.mileage) : undefined,
    engine: str(body.engine),
    transmission: str(body.transmission),
    driveType: str(body.driveType),
    fuelType: str(body.fuelType),
    notes: str(body.notes),
  };

  const parsed = createSchema.safeParse(clean);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    return apiError(msg, 400);
  }

  // The customer must belong to this shop — prevents attaching a vehicle to
  // another shop's customer.
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, shopId },
    select: { id: true },
  });
  if (!customer) return apiError("Customer not found", 404);

  const vehicle = await prisma.vehicle.create({ data: { ...parsed.data, shopId } });
  await logAudit(session!.user.id, AuditAction.CREATE, "Vehicle", vehicle.id, null, vehicle);

  return apiSuccess(vehicle, 201);
}
