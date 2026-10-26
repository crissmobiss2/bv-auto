import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { currentShopId } from "@/lib/tenant";
import { PLANS, billingState, platformStripe, priceIdFor } from "@/lib/billing";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  const shop = await prisma.shop.findUnique({
    where: { id: currentShopId()! },
    select: { billingExempt: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, plan: true, stripeCustomerId: true },
  });
  if (!shop) return apiError("Shop not found", 404);
  return apiSuccess({
    state: billingState(shop),
    plan: shop.plan,
    subscriptionStatus: shop.subscriptionStatus,
    trialEndsAt: shop.trialEndsAt,
    trialDaysLeft: shop.trialEndsAt ? Math.max(0, Math.ceil((shop.trialEndsAt.getTime() - Date.now()) / 86_400_000)) : 0,
    currentPeriodEnd: shop.currentPeriodEnd,
    hasBillingAccount: !!shop.stripeCustomerId,
    configured: !!platformStripe,
    plans: PLANS.map(({ id, name, price, features }) => ({ id, name, price, features, available: !!priceIdFor(id) })),
  });
}
