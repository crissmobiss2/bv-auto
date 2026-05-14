import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const bookingSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  vehicleYear: z.number().int().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  serviceType: z.string().min(1),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
  preferredDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid data", 400);

  const data = parsed.data;

  // Try to find existing customer by phone
  const existing = await prisma.customer.findFirst({
    where: { phone: data.phone },
    select: { id: true },
  });

  const request = await prisma.serviceRequest.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      vehicleYear: data.vehicleYear ?? null,
      vehicleMake: data.vehicleMake || null,
      vehicleModel: data.vehicleModel || null,
      serviceType: data.serviceType,
      description: data.description,
      photoUrl: data.photoUrl || null,
      preferredDate: data.preferredDate || null,
      customerId: existing?.id ?? null,
    },
  });

  return apiSuccess(request, 201);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const requests = await prisma.serviceRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, firstName: true, lastName: true } } },
  });

  return apiSuccess(requests);
}
