import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, requireRole, apiSuccess, apiError } from "@/lib/api-helpers";

export async function GET() {
  // Multi-tenant: a user only sees their own shop.
  const { error, shopId } = await requireShop();
  if (error) return error;
  const shops = await prisma.shop.findMany({ where: { id: shopId, isActive: true }, orderBy: { name: "asc" } });
  return apiSuccess(shops);
}

export async function POST(req: NextRequest) {
  // Shop creation is the tenant bootstrap — an admin may create a shop even
  // before they have one assigned. (No cross-shop `isDefault` clobber here.)
  const { error, session } = await requireRole(["ADMIN"]);
  if (error) return error;
  const body = await req.json();
  if (!body.name) return apiError("name is required");

  const shop = await prisma.shop.create({
    data: {
      name: body.name,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      phone: body.phone,
      email: body.email,
      // UI sends a percent (e.g. 8.25); store as a fraction (0.0825) — the read
      // paths (shops/settings, the shops page) multiply back by 100 to display.
      taxRate: body.taxRate ? Number(body.taxRate) / 100 : 0,
      laborRate: body.laborRate ? Number(body.laborRate) : 0,
      googleReviewUrl: body.googleReviewUrl,
      isDefault: body.isDefault ?? false,
    },
  });

  // If this admin has no shop yet, attach them to the one they just created.
  if (!session!.user.shopId) {
    await prisma.user.update({ where: { id: session!.user.id }, data: { shopId: shop.id } });
  }

  return apiSuccess(shop, 201);
}
