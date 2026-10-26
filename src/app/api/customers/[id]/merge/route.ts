import { NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { findDuplicateCustomers, mergeCustomers } from "@/lib/customer-merge";

type Params = { params: Promise<{ id: string }> };

/** Possible duplicates of this customer (same phone or email). */
export async function GET(_: NextRequest, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id }, select: { phone: true, email: true } });
  if (!customer) return apiError("Customer not found", 404);
  return apiSuccess({ duplicates: await findDuplicateCustomers(prisma, { ...customer, excludeId: id }) });
}

/** Merge `sourceId` into this customer. ADMIN only. */
export async function POST(req: NextRequest, { params }: Params) {
  const { error, session } = await requireRole(["ADMIN"]);
  if (error) return error;
  const { id } = await params;
  const { sourceId } = (await req.json().catch(() => ({}))) as { sourceId?: string };
  if (!sourceId || sourceId === id) return apiError("Choose a different customer to merge");

  const result = await prisma.$transaction(async (tx) => {
    const [target, source] = await Promise.all([
      tx.customer.findUnique({ where: { id } }),
      tx.customer.findUnique({ where: { id: sourceId } }),
    ]);
    if (!target?.isActive || !source?.isActive) return null;
    const moved = await mergeCustomers(tx, target, source);
    return { target, source, moved };
  });
  if (!result) return apiError("Both customers must exist and be active", 404);

  await logAudit(
    session!.user.id,
    AuditAction.UPDATE,
    "Customer",
    id,
    { mergedFrom: { id: sourceId, name: `${result.source.firstName} ${result.source.lastName}` } },
    { recordsMoved: result.moved },
    "Customer merge",
  );
  return apiSuccess({ merged: true, recordsMoved: result.moved });
}
