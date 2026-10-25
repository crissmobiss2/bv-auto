import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, PartStatus } from "@prisma/client";
import { z } from "zod";

const updatePartSchema = z.object({
  vendorId: z.string().nullable().optional(),
  purchaseOrderId: z.string().nullable().optional(),
  status: z.nativeEnum(PartStatus).optional(),
  partNumber: z.string().nullable().optional(),
  description: z.string().min(1).optional(),
  quantity: z.coerce.number().nonnegative().optional(),
  unitCost: z.coerce.number().nonnegative().nullable().optional(),
  unitPrice: z.coerce.number().nonnegative().nullable().optional(),
  markup: z.coerce.number().optional(),
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

  const updated = await prisma.jobPart.update({ where: { id }, data: updateData });
  await logAudit(session!.user.id, AuditAction.UPDATE, "JobPart", id, existing, updated);

  return apiSuccess(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await prisma.jobPart.delete({ where: { id } });
  await logAudit(session!.user.id, AuditAction.DELETE, "JobPart", id);

  return apiSuccess({ success: true });
}
