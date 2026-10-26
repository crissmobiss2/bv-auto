import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { currentShopId } from "@/lib/tenant";
import { FOUNDING_LIMIT, baseUrl, platformStripe, priceIdFor } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["ADMIN"]);
  if (error) return error;
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  const price = plan ? priceIdFor(plan) : null;
  if (!platformStripe || !price) return apiError("Billing isn't set up for this plan yet.", 503);

  const shopId = currentShopId()!;
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return apiError("Shop not found", 404);
  if (shop.billingExempt) return apiError("This shop doesn't need a subscription.", 400);
  if (shop.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(shop.subscriptionStatus ?? "")) {
    return apiError("You already have a subscription. Use Manage billing to change it.", 409);
  }
  if (plan === "founding") {
    // Raw query: shop queries are scoped to the signed-in shop, and this must count every shop.
    const [{ taken }] = await prisma.$queryRaw<{ taken: number }[]>`
      SELECT count(*)::int AS taken FROM "Shop"
      WHERE "plan" = 'founding' AND "subscriptionStatus" IN ('active', 'trialing', 'past_due') AND "id" <> ${shopId}`;
    if (taken >= FOUNDING_LIMIT) return apiError("The founding offer is full.", 409);
  }

  let customer = shop.stripeCustomerId;
  if (!customer) {
    customer = (await platformStripe.customers.create({
      name: shop.name,
      email: shop.email || session!.user.email || undefined,
      metadata: { shopId },
    })).id;
    await prisma.shop.update({ where: { id: shopId }, data: { stripeCustomerId: customer } });
  }

  // Carry the unused free trial over; Stripe needs trial_end at least 48 hours out.
  const trialEnd = shop.trialEndsAt && shop.trialEndsAt.getTime() > Date.now() + 49 * 3600_000
    ? Math.floor(shop.trialEndsAt.getTime() / 1000)
    : undefined;

  // A checkout finished moments ago may not have reached our webhook yet.
  const live = await platformStripe.subscriptions.list({ customer, status: "all", limit: 20 });
  if (live.data.some((s) => ["active", "trialing", "past_due"].includes(s.status))) {
    return apiError("You already have a subscription. Use Manage billing to change it.", 409);
  }

  // Only one checkout may be open at a time, so finishing two tabs can't create two subscriptions.
  const open = await platformStripe.checkout.sessions.list({ customer, status: "open", limit: 20 });
  await Promise.all(open.data.map((s) => platformStripe!.checkout.sessions.expire(s.id)));

  const checkout = await platformStripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: shopId,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { shopId },
    subscription_data: { metadata: { shopId }, ...(trialEnd && { trial_end: trialEnd }) },
    success_url: `${baseUrl()}/billing?subscribed=1`,
    cancel_url: `${baseUrl()}/billing`,
  });
  return apiSuccess({ url: checkout.url });
}
