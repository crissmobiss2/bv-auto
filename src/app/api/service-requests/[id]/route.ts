import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { status, notes, customerId } = body;

  const existing = await prisma.serviceRequest.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Service request not found", 404);

  const request = await prisma.serviceRequest.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(customerId !== undefined && { customerId: customerId || null }),
    },
  });

  return apiSuccess(request);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.serviceRequest.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Service request not found", 404);

  await prisma.serviceRequest.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
