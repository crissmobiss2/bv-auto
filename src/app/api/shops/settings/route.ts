import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";
import { shopDisplayName } from "@/lib/shop";
import { shopTaxRatePercent } from "@/lib/tax";

// Lightweight public-ish endpoint — returns the default shop's operating rates.
// Used by quote builder, labor times, pipeline, and anywhere else that needs
// the shop's configured labor rate and tax rate.
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const shop = await prisma.shop.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, laborRate: true, taxRate: true, partsMarkup: true, phone: true, googleReviewUrl: true },
  });

  return apiSuccess({
    laborRate: shop ? Number(shop.laborRate) : 105,
    taxRate: shopTaxRatePercent(shop?.taxRate), // stored as 0.105, return as 10.5
    partsMarkup: shop ? Number(shop.partsMarkup) : 40, // stored as percent, e.g. 40 = 40%
    shopName: shopDisplayName(shop?.name),
    shopPhone: shop?.phone ?? "",
    googleReviewUrl: shop?.googleReviewUrl ?? "",
  });
}
