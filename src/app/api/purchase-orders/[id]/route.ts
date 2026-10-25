import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, PartStatus, POStatus } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      items: {
        include: {
          job: { select: { id: true, jobNumber: true, title: true, customer: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });
  if (!po) return apiError("Purchase order not found", 404);
  return apiSuccess(po);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { status, notes, expectedAt } = body as { status?: string; notes?: string; expectedAt?: string };

  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!po) return apiError("Purchase order not found", 404);

  const data: Record<string, unknown> = {};
  if (notes != null) data.notes = notes;
  if (expectedAt != null) data.expectedAt = new Date(expectedAt);

  if (status) {
    if (!["DRAFT", "SENT", "CONFIRMED", "RECEIVED", "CANCELLED"].includes(status)) {
      return apiError("Invalid status", 400);
    }
    const allowed: Record<string, string[]> = {
      DRAFT: ["SENT", "CANCELLED"],
      SENT: ["CONFIRMED", "RECEIVED", "CANCELLED"],
      CONFIRMED: ["RECEIVED", "CANCELLED"],
      RECEIVED: [],
      CANCELLED: [],
    };
    if (status !== po.status && !allowed[po.status].includes(status)) {
      return apiError(`A ${po.status.toLowerCase()} purchase order cannot be marked ${status.toLowerCase()}`, 400);
    }
    data.status = status as POStatus;

    if (status === "SENT" && !po.orderedAt) data.orderedAt = new Date();
    if (status === "RECEIVED") {
      data.receivedAt = new Date();
      // Mark every item received (unless it was already returned/credited)
      await prisma.jobPart.updateMany({
        where: { purchaseOrderId: id, status: { in: [PartStatus.ORDERED, PartStatus.SHIPPED, PartStatus.PICKED_UP] } },
        data: { status: PartStatus.RECEIVED, receivedAt: new Date() },
      });
      await prisma.$executeRaw`UPDATE "JobPart" SET "quantityReceived" = "quantity" WHERE "purchaseOrderId" = ${id} AND "status" = 'RECEIVED'`;
    }
    if (status === "CANCELLED") {
      data.cancelledAt = new Date();
      // Release items back to open
      await prisma.jobPart.updateMany({
        where: { purchaseOrderId: id, status: { in: [PartStatus.ORDERED, PartStatus.SHIPPED, PartStatus.PICKED_UP] } },
        data: { status: PartStatus.REQUESTED, poNumber: null, purchaseOrderId: null, orderedAt: null },
      });
    }
  }

  const updated = await prisma.purchaseOrder.update({ where: { id }, data, include: { vendor: true, items: true } });
  await logAudit(session!.user.id, status ? AuditAction.STATUS_CHANGE : AuditAction.UPDATE, "PurchaseOrder", id, null, { status });
  return apiSuccess(updated);
}