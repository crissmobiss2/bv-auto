import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, apiError, apiSuccess } from "@/lib/api-helpers";
import { moveStock } from "@/lib/inventory";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  partNumber: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  quantityOnHand: z.number().int().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const lowStock = searchParams.get("lowStock") === "true";
  const location = searchParams.get("location");
  const search = searchParams.get("q");

  const items = await prisma.inventoryItem.findMany({
    where: {
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
  const { error, session } = await requireRole(["ADMIN", "PARTS_COORDINATOR", "DISPATCHER", "SERVICE_ADVISOR", "ACCOUNTANT"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const { quantityOnHand, ...rest } = parsed.data;
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({ data: { ...rest, quantityOnHand: 0 } });
    await moveStock(tx, {
      itemId: created.id,
      quantity: quantityOnHand,
      type: "INITIAL",
      unitCost: rest.unitCost,
      reason: "Opening stock",
      createdById: session!.user.id,
    });
    return tx.inventoryItem.findUniqueOrThrow({ where: { id: created.id } });
  });
  return apiSuccess(item, 201);
}
