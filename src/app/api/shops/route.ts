import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { SINGLE_SHOP_LOCK, SINGLE_SHOP_MESSAGE } from "@/lib/shop";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  const shops = await prisma.shop.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return apiSuccess(shops);
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;
  const body = await req.json();
  if (!body.name) return apiError("name is required");

  const shop = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SINGLE_SHOP_LOCK})`;
    if ((await tx.shop.count()) > 0) return null;
    return tx.shop.create({
    data: {
      name: body.name,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      phone: body.phone,
      email: body.email,
      taxRate: body.taxRate != null ? Number(body.taxRate) / 100 : 0,
      laborRate: body.laborRate ? Number(body.laborRate) : 0,
      partsMarkup: body.partsMarkup != null ? Number(body.partsMarkup) : 40,
      googleReviewUrl: body.googleReviewUrl,
      isDefault: true,
    },
    });
  });
  if (!shop) return apiError(SINGLE_SHOP_MESSAGE, 409);
  return apiSuccess(shop, 201);
}
