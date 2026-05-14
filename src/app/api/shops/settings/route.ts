import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

// Lightweight public-ish endpoint — returns the default shop's operating rates.
// Used by quote builder, labor times, pipeline, and anywhere else that needs
// the shop's configured labor rate and tax rate.
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const shop = await prisma.shop.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, laborRate: true, taxRate: true, phone: true, googleReviewUrl: true },
  });

  return apiSuccess({
    laborRate: shop ? Number(shop.laborRate) : 105,
    taxRate: shop ? Number(shop.taxRate) * 100 : 0, // stored as 0.0825, return as 8.25
    shopName: shop?.name ?? "B&V Mobile Auto",
    shopPhone: shop?.phone ?? "",
    googleReviewUrl: shop?.googleReviewUrl ?? "",
  });
}
