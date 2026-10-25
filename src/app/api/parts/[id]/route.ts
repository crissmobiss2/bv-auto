import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, PartStatus } from "@prisma/client";
import { z } from "zod";
import { InsufficientStockError, moveStock, RETURNED_PART_STATUSES } from "@/lib/inventory";

const updatePartSchema = z.object({
  vendorId: z.string().nullable().optional(),
  purchaseOrderId: z.string().nullable().optional(),
  status: z.nativeEnum(PartStatus).optional(),
  partNumber: z.string().nullable().optional(),
  description: z.string().min(1).optional(),
  quantity: z.coerce.number().nonnegative().max(10000).optional(),
  unitCost: z.coerce.number().nonnegative().nullable().optional(),
  unitPrice: z.coerce.number().nonnegative().nullable().optional(),
  markup: z.coerce.number().min(0).max(500).optional(),
  inventoryItemId: z.string().nullable().optional(),
  totalCost: z.coerce.number().nonnegative().nullable().optional(),
  totalPrice: z.coerce.number().nonnegative().nullable().optional(),
  creditAmount: z.coerce.number().nonnegative().nullable().optional(),
  returnReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  coreReturn: z.boolean().optional(),
  coreCharge: z.coerce.number().nonnegative().nullable().optional(),
}).partial();

const STATUS_TIMESTAMP_MAP: Partial<Record<PartStatus, string>> = {
  QUOTED: "quotedAt",
  ORDERED: "orderedAt",
  SHIPPED: "shippedAt",
  RECEIVED: "receivedAt",
  INSTALLED: "installedAt",
  RETURNED: "returnedAt",
  CREDITED: "creditedAt",
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updatePartSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  // Technicians may move a part through ordered/received/installed, but they
  // must not be able to rewrite cost, sell price, or markup.
  const pricingFields = ["unitCost", "unitPrice", "markup", "totalCost", "totalPrice", "creditAmount", "coreCharge"] as const;
  if (
    session!.user.role === "TECHNICIAN" &&
    pricingFields.some((field) => parsed.data[field] !== undefined)
  ) {
    return apiError("Only parts, dispatch, or accounting staff can change part pricing", 403);
  }

  const existing = await prisma.jobPart.findUnique({ where: { id } });
  if (!existing) return apiError("Part not found", 404);

  const updateData: Record<string, unknown> = { ...parsed.data };

  // Auto-set timestamp when status changes
  if (parsed.data.status && parsed.data.status !== existing.status) {
    const tsField = STATUS_TIMESTAMP_MAP[parsed.data.status];
    if (tsField) updateData[tsField] = new Date();
  }

  if (parsed.data.vendorId) {
    const vendor = await prisma.partsVendor.findFirst({ where: { id: parsed.data.vendorId, isActive: true }, select: { id: true } });
    if (!vendor) return apiError("Vendor not found or inactive", 400);
  }
  if (parsed.data.status === PartStatus.RECEIVED) {
    updateData.quantityReceived = parsed.data.quantity ?? existing.quantity;
  }
  if (existing.inventoryIssuedQty > 0 && parsed.data.inventoryItemId !== undefined && parsed.data.inventoryItemId !== existing.inventoryItemId) {
    return apiError("Return this part to stock before linking it to a different inventory item", 400);
  }

  // Stock-backed parts leave inventory when installed and go back on the
  // shelf when returned/cancelled; the ledger row and stock change commit
  // together with the part update.
  const itemId = parsed.data.inventoryItemId !== undefined ? parsed.data.inventoryItemId : existing.inventoryItemId;
  const nextStatus = parsed.data.status ?? existing.status;
  const qty = Math.ceil(Number(parsed.data.quantity ?? existing.quantity));
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      if (itemId && nextStatus === PartStatus.INSTALLED && existing.inventoryIssuedQty === 0 && qty > 0) {
        await moveStock(tx, { itemId, quantity: -qty, type: "ISSUE", jobId: existing.jobId, jobPartId: id, createdById: session!.user.id, reason: "Installed on job" });
        updateData.inventoryIssuedQty = qty;
      } else if (
        existing.inventoryItemId && existing.inventoryIssuedQty > 0 &&
        (RETURNED_PART_STATUSES as readonly string[]).includes(nextStatus)
      ) {
        await moveStock(tx, { itemId: existing.inventoryItemId, quantity: existing.inventoryIssuedQty, type: "RETURN", jobId: existing.jobId, jobPartId: id, createdById: session!.user.id, reason: `Part ${nextStatus.toLowerCase()}` });
        updateData.inventoryIssuedQty = 0;
      }
      return tx.jobPart.update({ where: { id }, data: updateData });
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) return apiError(`Not enough stock to install (on hand: ${e.available})`, 409);
    throw e;
  }
  await logAudit(session!.user.id, AuditAction.UPDATE, "JobPart", id, existing, updated);

  return apiSuccess(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const part = await prisma.jobPart.findUnique({ where: { id } });
  if (!part) return apiError("Part not found", 404);
  await prisma.$transaction(async (tx) => {
    if (part.inventoryItemId && part.inventoryIssuedQty > 0) {
      await moveStock(tx, { itemId: part.inventoryItemId, quantity: part.inventoryIssuedQty, type: "RETURN", jobId: part.jobId, createdById: session!.user.id, reason: "Part deleted from job" });
    }
    await tx.jobPart.delete({ where: { id } });
  });
  await logAudit(session!.user.id, AuditAction.DELETE, "JobPart", id);

  return apiSuccess({ success: true });
}
