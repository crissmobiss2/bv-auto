import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.jobPart.findUnique({ where: { id } });
  if (!existing) return apiError("Part not found", 404);

  const updateData: Record<string, unknown> = { ...body };

  // Auto-set timestamp when status changes
  if (body.status && body.status !== existing.status) {
    const tsField = STATUS_TIMESTAMP_MAP[body.status as PartStatus];
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
