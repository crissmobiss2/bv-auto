import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError, pick } from "@/lib/api-helpers";

const SHOP_FIELDS = [
  "name", "address", "city", "state", "zip", "phone", "email",
  "logoUrl", "googleReviewUrl", "isActive", "isDefault",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Shop config is admin-only, and an admin may only edit their own shop.
  const { error, shopId } = await requireShop(["ADMIN"]);
  if (error) return error;
  const { id } = await params;
  if (id !== shopId) return apiError("You can only edit your own shop", 403);

  const body = await req.json();
  const shop = await prisma.shop.update({
    where: { id },
    data: {
      ...pick(body, SHOP_FIELDS),
      // UI sends a percent (8.25); store as a fraction (0.0825) — read paths ×100.
      taxRate: body.taxRate != null ? Number(body.taxRate) / 100 : undefined,
      laborRate: body.laborRate != null ? Number(body.laborRate) : undefined,
    },
  });
  return apiSuccess(shop);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop(["ADMIN"]);
  if (error) return error;
  const { id } = await params;
  if (id !== shopId) return apiError("You can only modify your own shop", 403);
  await prisma.shop.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ ok: true });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;
  const { id } = await params;
  if (id !== shopId) return apiError("Shop not found", 404);
  const shop = await prisma.shop.findUnique({ where: { id } });
  if (!shop) return apiError("Shop not found", 404);
  return apiSuccess(shop);
}
