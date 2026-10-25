import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const updateShopSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  laborRate: z.coerce.number().min(0).optional(),
  partsMarkup: z.coerce.number().min(0).optional(),
  logoUrl: z.string().nullable().optional(),
  googleReviewUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}).partial();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;
  const { id } = await params;
  const body = await req.json();
  const parsed = updateShopSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const { taxRate, email, ...rest } = parsed.data;
  if (rest.isDefault) {
    await prisma.shop.updateMany({ data: { isDefault: false } });
  }
  const shop = await prisma.shop.update({
    where: { id },
    data: {
      ...rest,
      ...(email !== undefined && { email: email || null }),
      ...(taxRate !== undefined && { taxRate: taxRate / 100 }),
    },
  });
  return apiSuccess(shop);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN"]);
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
