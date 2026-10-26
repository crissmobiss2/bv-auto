import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, PartStatus } from "@prisma/client";
import { withUniqueRetry } from "@/lib/utils";

function generatePONumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `PO-${year}${month}-${random}`;
}

// GET /api/purchase-orders?status=&vendorId=
export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") || undefined;
  const vendorId = searchParams.get("vendorId") || undefined;

  const orders = await prisma.purchaseOrder.findMany({
    where: { ...(status ? { status: status as never } : {}), ...(vendorId ? { vendorId } : {}) },
    include: {
      vendor: { select: { id: true, name: true, phone: true, email: true, website: true } },
      items: { select: { id: true, description: true, partNumber: true, quantity: true, unitCost: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return apiSuccess(orders);
}

// POST /api/purchase-orders — create an order for selected open parts
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { vendorId, partIds, notes, expectedAt } = body as {
    vendorId?: string;
    partIds?: string[];
    notes?: string;
    expectedAt?: string;
  };

  if (!vendorId) return apiError("Pick a vendor for this order", 400);
  if (!partIds || partIds.length === 0) return apiError("Select at least one part to order", 400);

  const vendor = await prisma.partsVendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return apiError("Vendor not found", 404);

  const parts = await prisma.jobPart.findMany({
    where: { id: { in: partIds }, status: { in: [PartStatus.REQUESTED, PartStatus.QUOTED] } },
  });
  if (parts.length === 0) return apiError("Selected parts are no longer open", 400);

  const estimatedTotal = parts.reduce(
    (s, p) => s + Number(p.unitCost ?? p.unitPrice ?? 0) * Number(p.quantity),
    0
  );

  const po = await withUniqueRetry(() => prisma.purchaseOrder.create({
    data: {
      poNumber: generatePONumber(),
      vendorId,
      status: "DRAFT",
      notes: notes || null,
      expectedAt: expectedAt ? new Date(expectedAt) : null,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      createdBy: session!.user.id,
      items: {
        connect: parts.map((p) => ({ id: p.id })),
      },
    },
    include: { vendor: true, items: true },
  }));

  // Stamp parts onto the order
  await prisma.jobPart.updateMany({
    where: { id: { in: parts.map((p) => p.id) } },
    data: { poNumber: po.poNumber, vendorId, status: PartStatus.ORDERED, orderedAt: new Date() },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "PurchaseOrder", po.id, null, {
    poNumber: po.poNumber,
    vendorId,
    partCount: parts.length,
  });

  return apiSuccess(po, 201);
}