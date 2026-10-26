import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { currentShopId } from "@/lib/tenant";
import { baseUrl, platformStripe } from "@/lib/billing";

export async function POST() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;
  const shop = await prisma.shop.findUnique({ where: { id: currentShopId()! }, select: { stripeCustomerId: true } });
  if (!platformStripe || !shop?.stripeCustomerId) return apiError("No billing account yet. Choose a plan first.", 400);
  const portal = await platformStripe.billingPortal.sessions.create({
    customer: shop.stripeCustomerId,
    return_url: `${baseUrl()}/billing`,
  });
  return apiSuccess({ url: portal.url });
}
