import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  const shops = await prisma.shop.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return apiSuccess(shops);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  const body = await req.json();
  if (!body.name) return apiError("name is required");

  if (body.isDefault) {
    await prisma.shop.updateMany({ data: { isDefault: false } });
  }
  const shop = await prisma.shop.create({
    data: {
      name: body.name,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      phone: body.phone,
      email: body.email,
      taxRate: body.taxRate ? Number(body.taxRate) : 0,
      laborRate: body.laborRate ? Number(body.laborRate) : 0,
      googleReviewUrl: body.googleReviewUrl,
      isDefault: body.isDefault ?? false,
    },
  });
  return apiSuccess(shop, 201);
}
