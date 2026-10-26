import { NextRequest } from "next/server";
import { z } from "zod";
import { AuditAction, PartStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, logAudit, requireRole } from "@/lib/api-helpers";

const schema = z.object({
  items: z.array(z.object({ partId: z.string().min(1), quantity: z.number().positive().max(10000) })).min(1),
});

// Partial receiving: record what actually arrived per line. A line is
// RECEIVED once its full quantity is in; the PO is RECEIVED once every line is.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN", "PARTS_COORDINATOR", "DISPATCHER", "SERVICE_ADVISOR"]);
  if (error) return error;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!po) return apiError("Purchase order not found", 404);
  if (!["SENT", "CONFIRMED"].includes(po.status)) {
    return apiError("Only sent or confirmed purchase orders can be received", 400);
  }

  const byId = new Map(po.items.map((p) => [p.id, p]));
  const requested = new Map<string, number>();
  for (const line of parsed.data.items) {
    requested.set(line.partId, (requested.get(line.partId) ?? 0) + line.quantity);
  }
  for (const [partId, quantity] of requested) {
    const part = byId.get(partId);
    if (!part) return apiError("Part is not on this purchase order", 400);
    const remaining = Number(part.quantity) - Number(part.quantityReceived);
    if (quantity > remaining + 1e-9) {
      return apiError(`Received quantity exceeds what is outstanding for ${part.description} (${remaining})`, 400);
    }
  }

  const now = new Date();
  const receivedById = new Map(po.items.map((p) => [p.id, Number(p.quantityReceived)]));
  for (const [partId, quantity] of requested) {
    receivedById.set(partId, receivedById.get(partId)! + quantity);
  }
  // Open = units still outstanding, regardless of line status (a line can be
  // INSTALLED before every unit has arrived).
  const open = po.items.filter(
    (p) =>
      p.status !== PartStatus.RETURNED && p.status !== PartStatus.CREDITED &&
      receivedById.get(p.id)! < Number(p.quantity) - 1e-9,
  ).length;

  const updated = await prisma.$transaction(async (tx) => {
    for (const partId of requested.keys()) {
      const part = byId.get(partId)!;
      const received = receivedById.get(part.id)!;
      const complete = received >= Number(part.quantity) - 1e-9;
      await tx.jobPart.update({
        where: { id: part.id },
        data: {
          quantityReceived: received,
          ...(complete ? { receivedAt: now, ...(part.status === PartStatus.INSTALLED ? {} : { status: PartStatus.RECEIVED }) } : {}),
        },
      });
    }
    return tx.purchaseOrder.update({
      where: { id },
      data: open === 0 ? { status: "RECEIVED", receivedAt: now } : { status: "CONFIRMED" },
      include: { vendor: true, items: true },
    });
  });

  await logAudit(session!.user.id, AuditAction.UPDATE, "PurchaseOrder", id, null, { received: parsed.data.items });
  return apiSuccess(updated);
}
