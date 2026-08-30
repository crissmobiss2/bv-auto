import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess } from "@/lib/api-helpers";

// Returns the caller's own shop operating rates. Read by the quote builder,
// labor times, pipeline, etc., so it is open to all staff (not admin-only) but
// strictly scoped to the caller's shop.
export async function GET() {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
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
