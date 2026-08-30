import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit, pick } from "@/lib/api-helpers";
import { AuditAction, PartStatus } from "@prisma/client";

const STATUS_TIMESTAMP_MAP: Partial<Record<PartStatus, string>> = {
  QUOTED: "quotedAt",
  ORDERED: "orderedAt",
  SHIPPED: "shippedAt",
  RECEIVED: "receivedAt",
  INSTALLED: "installedAt",
  RETURNED: "returnedAt",
  CREDITED: "creditedAt",
};

const PART_FIELDS = [
  "status", "vendorId", "partNumber", "description", "quantity", "unitCost",
  "unitPrice", "markup", "notes", "poNumber", "coreReturn", "coreCharge",
  "returnReason", "creditAmount",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  // Scope through the parent job's shop.
  const existing = await prisma.jobPart.findFirst({ where: { id, job: { shopId } } });
  if (!existing) return apiError("Part not found", 404);

  const updateData: Record<string, unknown> = pick(body, PART_FIELDS);

  // Auto-set timestamp when status changes
  if (body.status && body.status !== existing.status) {
    const tsField = STATUS_TIMESTAMP_MAP[body.status as PartStatus];
    if (tsField) updateData[tsField] = new Date();
  }

  // Keep derived totals consistent when cost/price/quantity change.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const qty = Number(updateData.quantity ?? existing.quantity);
  if (updateData.unitCost != null || updateData.quantity != null) {
    const unitCost = Number(updateData.unitCost ?? existing.unitCost ?? 0);
    updateData.totalCost = round2(unitCost * qty);
  }
  if (updateData.unitPrice != null || updateData.quantity != null) {
    const unitPrice = Number(updateData.unitPrice ?? existing.unitPrice ?? 0);
    updateData.totalPrice = round2(unitPrice * qty);
  }

  const updated = await prisma.jobPart.update({ where: { id }, data: updateData });
  await logAudit(session!.user.id, AuditAction.UPDATE, "JobPart", id, existing, updated);

  return apiSuccess(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.jobPart.findFirst({ where: { id, job: { shopId } } });
  if (!existing) return apiError("Part not found", 404);

  await prisma.jobPart.delete({ where: { id } });
  await logAudit(session!.user.id, AuditAction.DELETE, "JobPart", id);

  return apiSuccess({ success: true });
}
