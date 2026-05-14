import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { generateInvoiceNumber, calculateLineItemTotal } from "@/lib/utils";
import { AuditAction, QuoteStatus } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
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
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.quote.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!existing) return apiError("Quote not found", 404);

  const updateData: Record<string, unknown> = {};

  // Handle line item recalculation
  if (body.lineItems) {
    const lineItemsWithTotals = body.lineItems.map((li: {
      quantity: number;
      unitPrice: number;
      markup?: number;
      discount?: number;
      taxable?: boolean;
      type?: string;
    }) => ({
      ...li,
      total: calculateLineItemTotal(li.quantity, li.unitPrice, li.markup, li.discount),
    }));

    const subtotal = lineItemsWithTotals
      .filter((li: { type?: string }) => li.type !== "TAX" && li.type !== "DISCOUNT")
      .reduce((sum: number, li: { total: number }) => sum + li.total, 0);

    const taxRate = body.taxRate ?? existing.taxRate;
    const taxableAmount = lineItemsWithTotals
      .filter((li: { taxable?: boolean; type?: string }) => li.taxable && li.type !== "TAX")
      .reduce((sum: number, li: { total: number }) => sum + li.total, 0);

    const taxAmount = Math.round(Number(taxableAmount) * (Number(taxRate) / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    updateData.subtotal = subtotal;
    updateData.taxAmount = taxAmount;
    updateData.totalAmount = totalAmount;
    updateData.taxRate = taxRate;

    // Replace line items
    await prisma.lineItem.deleteMany({ where: { quoteId: id } });
    await prisma.lineItem.createMany({
      data: lineItemsWithTotals.map((li: Record<string, unknown>) => ({ ...li, quoteId: id })),
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
