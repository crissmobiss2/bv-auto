import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  let status = body.status;
  if (!status && body.expiryDate) {
    const current = await prisma.warranty.findUnique({ where: { id }, select: { status: true } });
    if (!current) return apiError("Warranty not found", 404);
    const lapsed = new Date(body.expiryDate) < new Date();
    if (current.status === "EXPIRED" && !lapsed) status = "ACTIVE";
    if (current.status === "ACTIVE" && lapsed) status = "EXPIRED";
  }

  const warranty = await prisma.warranty.update({
    where: { id },
    data: {
      status,
      claimedAt: body.status === "CLAIMED" ? new Date() : undefined,
      claimNotes: body.claimNotes,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    },
  });

  return apiSuccess(warranty);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await prisma.warranty.update({ where: { id }, data: { status: "VOIDED" } });
  return apiSuccess({ voided: true });
}
