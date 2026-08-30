import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import { WarrantyStatus, WarrantyType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const filter = searchParams.get("filter") || "active";
  const customerId = searchParams.get("customerId");

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const in30 = new Date(now.getTime() + 30 * 86400000);

  const where: Record<string, unknown> = { customer: { shopId } };
  if (customerId) where.customerId = customerId;
  if (filter === "active") where.status = WarrantyStatus.ACTIVE;
  if (filter === "expiring") where.expiryDate = { lte: in30, gte: now };
  if (filter === "expiring_soon") where.expiryDate = { lte: in7, gte: now };
  if (filter === "claimed") where.status = WarrantyStatus.CLAIMED;

  const warranties = await prisma.warranty.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vehicle: { select: { id: true, year: true, make: true, model: true } },
      job: { select: { id: true, jobNumber: true, title: true } },
    },
    orderBy: { expiryDate: "asc" },
    take: 100,
  });

  const expiringSoon = await prisma.warranty.count({ where: { customer: { shopId }, status: WarrantyStatus.ACTIVE, expiryDate: { lte: in7, gte: now } } });
  const expiring30 = await prisma.warranty.count({ where: { customer: { shopId }, status: WarrantyStatus.ACTIVE, expiryDate: { lte: in30, gte: now } } });
  const totalActive = await prisma.warranty.count({ where: { customer: { shopId }, status: WarrantyStatus.ACTIVE } });

  return apiSuccess({ warranties, stats: { totalActive, expiringSoon, expiring30 } });
}

export async function POST(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json();
  const { jobId, type, description, durationDays, mileageLimit, partNumber } = body;

  if (!jobId || !description) return apiError("jobId and description required");

  const job = await prisma.job.findFirst({
    where: { id: jobId, shopId },
    select: { customerId: true, vehicleId: true, mileageIn: true },
  });
  if (!job) return apiError("Job not found");

  const startDate = new Date();
  const expiryDate = durationDays ? new Date(startDate.getTime() + durationDays * 86400000) : null;

  const warranty = await prisma.warranty.create({
    data: {
      jobId,
      customerId: job.customerId,
      vehicleId: job.vehicleId,
      type: (type as WarrantyType) || WarrantyType.PARTS,
      description,
      partNumber,
      startDate,
      expiryDate,
      mileageAtService: job.mileageIn,
      mileageLimit: mileageLimit ? Number(mileageLimit) : null,
      durationDays: durationDays ? Number(durationDays) : null,
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      vehicle: { select: { year: true, make: true, model: true } },
    },
  });

  return apiSuccess(warranty, 201);
}
