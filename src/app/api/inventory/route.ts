import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  partNumber: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  quantityOnHand: z.number().int().default(0),
  reorderPoint: z.number().int().default(0),
  unitCost: z.number().default(0),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const lowStock = searchParams.get("lowStock") === "true";
  const location = searchParams.get("location");
  const search = searchParams.get("q");

  const items = await prisma.inventoryItem.findMany({
    where: {
      shopId,
      isActive: true,
      ...(location && { location }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { partNumber: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { name: "asc" },
  });

  const filtered = lowStock ? items.filter((i) => i.quantityOnHand <= i.reorderPoint) : items;
  return apiSuccess(filtered);
}

export async function POST(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid data", 400);

  const item = await prisma.inventoryItem.create({ data: { ...parsed.data, shopId } });
  return apiSuccess(item, 201);
}
