import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const warranty = await prisma.warranty.update({
    where: { id },
    data: {
      status: body.status,
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
