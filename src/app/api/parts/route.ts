import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { z } from "zod";
import { AuditAction } from "@prisma/client";

const createSchema = z.object({
  jobId: z.string(),
  vendorId: z.string().optional(),
  partNumber: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive().max(10000).default(1),
  unitCost: z.number().min(0).max(1_000_000).optional(),
  unitPrice: z.number().min(0).max(1_000_000).optional(),
  markup: z.number().min(0).max(500).optional(),
  inventoryItemId: z.string().optional(),
  poNumber: z.string().optional(),
  coreReturn: z.boolean().optional(),
  coreCharge: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;

  const parts = await prisma.jobPart.findMany({
    where,
    include: {
      vendor: true,
      job: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          vehicle: { select: { id: true, year: true, make: true, model: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(parts);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const data = parsed.data;
  if (data.vendorId) {
    const vendor = await prisma.partsVendor.findFirst({ where: { id: data.vendorId, isActive: true }, select: { id: true } });
    if (!vendor) return apiError("Vendor not found or inactive", 400);
  }
  let stockCost: number | undefined;
  if (data.inventoryItemId) {
    const stock = await prisma.inventoryItem.findFirst({ where: { id: data.inventoryItemId, isActive: true } });
    if (!stock) return apiError("Inventory item not found", 400);
    stockCost = Number(stock.unitCost);
    data.partNumber ??= stock.partNumber ?? undefined;
  }
  const unitCost = data.unitCost ?? stockCost ?? 0;
  let markup = data.markup;
  if (markup == null && data.unitPrice == null) {
    const shop = await prisma.shop.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { partsMarkup: true },
    });
    markup = shop ? Number(shop.partsMarkup) : 40;
  }
  markup ??= 0;
  const unitPrice = data.unitPrice ?? (unitCost * (1 + markup / 100));
  const totalCost = unitCost * data.quantity;
  const totalPrice = unitPrice * data.quantity;

  const part = await prisma.jobPart.create({
    data: {
      ...data,
      unitCost,
      markup,
      unitPrice,
      totalCost,
      totalPrice,
    },
    include: { vendor: true },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "JobPart", part.id, null, part);

  return apiSuccess(part, 201);
}
