import { InventoryMovementType, Prisma } from "@prisma/client";

export class InsufficientStockError extends Error {
  constructor(public available: number) {
    super("INSUFFICIENT_STOCK");
    this.name = "InsufficientStockError";
  }
}

/**
 * Apply a signed stock change and write the ledger row in the same
 * transaction. Decrements are conditional, so stock can never go negative
 * even under concurrent issues.
 */
export async function moveStock(
  tx: Prisma.TransactionClient,
  opts: {
    itemId: string;
    quantity: number;
    type: InventoryMovementType;
    reason?: string | null;
    unitCost?: number | null;
    jobId?: string | null;
    jobPartId?: string | null;
    purchaseOrderId?: string | null;
    createdById?: string | null;
  },
) {
  const qty = Math.trunc(opts.quantity);
  if (qty === 0) return null;
  const res = await tx.inventoryItem.updateMany({
    where: { id: opts.itemId, ...(qty < 0 ? { quantityOnHand: { gte: -qty } } : {}) },
    data: { quantityOnHand: { increment: qty } },
  });
  const item = await tx.inventoryItem.findUnique({ where: { id: opts.itemId }, select: { quantityOnHand: true } });
  if (!item) throw new Error("Inventory item not found");
  if (res.count === 0) throw new InsufficientStockError(item.quantityOnHand);
  return tx.inventoryMovement.create({
    data: {
      itemId: opts.itemId,
      type: opts.type,
      quantity: qty,
      balanceAfter: item.quantityOnHand,
      unitCost: opts.unitCost ?? undefined,
      reason: opts.reason ?? undefined,
      jobId: opts.jobId ?? undefined,
      jobPartId: opts.jobPartId ?? undefined,
      purchaseOrderId: opts.purchaseOrderId ?? undefined,
      createdById: opts.createdById ?? undefined,
    },
  });
}

/** Statuses at which a stock-backed part has physically left the shelf. */
export const ISSUED_PART_STATUSES = ["INSTALLED"] as const;
/** Statuses at which an issued part goes back on the shelf. */
export const RETURNED_PART_STATUSES = ["RETURNED", "CANCELLED", "REQUESTED"] as const;
