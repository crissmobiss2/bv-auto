import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const item = await prisma.inventoryItem.findFirst({ where: { id, shopId } });
  if (!item) return apiError("Not found", 404);
  return apiSuccess(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.inventoryItem.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Not found", 404);

  const body = await req.json();
  const { name, partNumber, description, category, quantityOnHand, reorderPoint, unitCost, location, notes, isActive, adjustment } = body;

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(partNumber !== undefined && { partNumber }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(quantityOnHand !== undefined && { quantityOnHand }),
      ...(reorderPoint !== undefined && { reorderPoint }),
      ...(unitCost !== undefined && { unitCost }),
      ...(location !== undefined && { location }),
      ...(notes !== undefined && { notes }),
      ...(isActive !== undefined && { isActive }),
      ...(adjustment !== undefined && { quantityOnHand: { increment: adjustment } }),
    },
  });

  return apiSuccess(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.inventoryItem.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Not found", 404);

  await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ deleted: true });
}
