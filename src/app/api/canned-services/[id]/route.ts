import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.cannedService.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Not found", 404);

  const body = await req.json();

  const service = await prisma.cannedService.update({
    where: { id },
    data: {
      name: body.name,
      category: body.category,
      description: body.description,
      laborHours: body.laborHours,
      laborPrice: body.laborPrice,
      parts: body.parts,
      totalPrice: body.totalPrice,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    },
  });
  return apiSuccess(service);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.cannedService.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Not found", 404);

  await prisma.cannedService.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ ok: true });
}
