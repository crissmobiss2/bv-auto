import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, apiError, apiSuccess } from "@/lib/api-helpers";
import { InsufficientStockError, moveStock } from "@/lib/inventory";

const STOCK_ROLES = ["ADMIN", "PARTS_COORDINATOR", "DISPATCHER", "SERVICE_ADVISOR", "ACCOUNTANT"];

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  partNumber: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  reorderPoint: z.number().int().min(0).max(100000).optional(),
  unitCost: z.number().min(0).max(1_000_000).optional(),
  location: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  // Stock changes always go through the ledger: a signed adjustment or a physical count.
  adjustment: z.number().int().refine((n) => n !== 0, "Adjustment cannot be zero").optional(),
  countedQuantity: z.number().int().min(0).optional(),
  reason: z.string().max(500).optional(),
  quantityOnHand: z.never({ message: "Change stock with an adjustment or a count, not by setting quantityOnHand" }).optional(),
}).strict();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return apiError("Not found", 404);
  return apiSuccess(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(STOCK_ROLES);
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);
  const { adjustment, countedQuantity, reason, ...fields } = parsed.data;
  if (adjustment !== undefined && countedQuantity !== undefined) {
    return apiError("Send either adjustment or countedQuantity, not both", 400);
  }

  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);

  try {
    const item = await prisma.$transaction(async (tx) => {
      if (Object.keys(fields).length > 0) {
        await tx.inventoryItem.update({ where: { id }, data: fields });
      }
      if (adjustment !== undefined || countedQuantity !== undefined) {
        await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
        const current = await tx.inventoryItem.findUniqueOrThrow({ where: { id }, select: { quantityOnHand: true } });
        const delta = adjustment ?? countedQuantity! - current.quantityOnHand;
        await moveStock(tx, {
          itemId: id,
          quantity: delta,
          type: "ADJUST",
          reason: reason || (countedQuantity !== undefined ? `Physical count: ${countedQuantity}` : "Manual adjustment"),
          createdById: session!.user.id,
        });
      }
      return tx.inventoryItem.findUniqueOrThrow({ where: { id } });
    });
    return apiSuccess(item);
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return apiError(`Not enough stock (on hand: ${e.available})`, 409);
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(STOCK_ROLES);
  if (error) return error;

  const { id } = await params;
  await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ deleted: true });
}
