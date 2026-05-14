import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const body = await req.json();
  if (body.isDefault) {
    await prisma.shop.updateMany({ data: { isDefault: false } });
  }
  const shop = await prisma.shop.update({
    where: { id },
    data: {
      ...body,
      taxRate: body.taxRate != null ? Number(body.taxRate) : undefined,
      laborRate: body.laborRate != null ? Number(body.laborRate) : undefined,
    },
  });
  return apiSuccess(shop);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  await prisma.shop.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ ok: true });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const shop = await prisma.shop.findUnique({ where: { id } });
  if (!shop) return apiError("Shop not found", 404);
  return apiSuccess(shop);
}
