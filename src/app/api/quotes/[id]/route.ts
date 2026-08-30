import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { calculateLineItemTotal, computeTotals } from "@/lib/utils";
import { AuditAction, QuoteStatus, LineItemType } from "@prisma/client";

const QUOTE_ROLES = ["ADMIN", "DISPATCHER", "ACCOUNTANT", "SERVICE_ADVISOR"] as const;

type IncomingLineItem = {
  type?: string;
  sortOrder?: number;
  description?: string;
  partNumber?: string | null;
  quantity?: number;
  unitPrice?: number;
  markup?: number | null;
  discount?: number | null;
  taxable?: boolean;
  notes?: string | null;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop(QUOTE_ROLES);
  if (error) return error;

  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, shopId },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!quote) return apiError("Quote not found", 404);
  return apiSuccess(quote);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, shopId } = await requireShop(QUOTE_ROLES);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.quote.findFirst({
    where: { id, shopId },
    include: { lineItems: true },
  });
  if (!existing) return apiError("Quote not found", 404);

  const updateData: Record<string, unknown> = {};

  // Handle line item recalculation
  if (body.lineItems) {
    const lineItemsWithTotals = (body.lineItems as IncomingLineItem[]).map((li) => ({
      type: (li.type as LineItemType) ?? LineItemType.LABOR,
      sortOrder: li.sortOrder ?? 0,
      description: li.description ?? "",
      partNumber: li.partNumber ?? null,
      quantity: li.quantity ?? 1,
      unitPrice: li.unitPrice ?? 0,
      markup: li.markup ?? null,
      discount: li.discount ?? null,
      taxable: li.taxable ?? true,
      notes: li.notes ?? null,
      total: calculateLineItemTotal(li.quantity ?? 1, li.unitPrice ?? 0, li.markup, li.discount),
    }));

    const taxRate = Number(body.taxRate ?? existing.taxRate);
    const { subtotal, discountAmount, taxAmount, totalAmount } = computeTotals(lineItemsWithTotals, taxRate);

    updateData.subtotal = subtotal;
    updateData.discountAmount = discountAmount;
    updateData.taxAmount = taxAmount;
    updateData.totalAmount = totalAmount;
    updateData.taxRate = taxRate;

    // Replace line items with an explicit field map (never spread client input).
    await prisma.lineItem.deleteMany({ where: { quoteId: id } });
    await prisma.lineItem.createMany({
      data: lineItemsWithTotals.map((li) => ({ ...li, quoteId: id })),
    });
  }

  // Status transitions
  if (body.status === QuoteStatus.APPROVED) {
    updateData.approvedAt = new Date();
  } else if (body.status === QuoteStatus.DECLINED) {
    updateData.declinedAt = new Date();
  } else if (body.status === QuoteStatus.SENT) {
    updateData.sentAt = new Date();
  }

  const simpleFields = ["status", "notes", "internalNotes", "validUntil", "approvedBy", "approvalMethod", "declineReason", "depositPaid"];
  for (const field of simpleFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  const updated = await prisma.quote.update({ where: { id }, data: updateData });

  // If approved, update job status
  if (body.status === QuoteStatus.APPROVED) {
    await prisma.job.update({
      where: { id: existing.jobId },
      data: { status: "APPROVED" },
    });
  }

  await logAudit(session!.user.id, AuditAction.UPDATE, "Quote", id, existing, updated);

  return apiSuccess(updated);
}
