import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { clearBillingCache, planForPrice, platformStripe } from "@/lib/billing";

// Subscription events from the platform's Stripe account.
export async function POST(req: NextRequest) {
  const secret = process.env.PLATFORM_STRIPE_WEBHOOK_SECRET;
  if (!platformStripe || !secret) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = platformStripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  let subscriptionId: string | null = null;
  let shopId: string | null = null;
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    if (s.mode === "subscription" && s.subscription) {
      subscriptionId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
      shopId = s.metadata?.shopId || s.client_reference_id || null;
    }
  } else if (event.type.startsWith("customer.subscription.")) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  }
  if (subscriptionId) await syncSubscription(subscriptionId, shopId);
  return NextResponse.json({ received: true });
}

/** Re-reads the subscription so out-of-order or retried events can't store a stale status. */
async function syncSubscription(subscriptionId: string, shopIdHint: string | null) {
  const sub = await platformStripe!.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const shopId = shopIdHint || sub.metadata?.shopId || null;
  const shop = await prisma.shop.findFirst({
    where: shopId ? { id: shopId } : { stripeCustomerId: customerId },
    select: { id: true, stripeSubscriptionId: true, subscriptionStatus: true },
  });
  if (!shop) return;
  // An old, ended subscription must not overwrite the shop's current one.
  const current = shop.stripeSubscriptionId && shop.stripeSubscriptionId !== sub.id &&
    ["active", "trialing", "past_due"].includes(shop.subscriptionStatus ?? "");
  if (current && !["active", "trialing", "past_due"].includes(sub.status)) return;
  const item = sub.items.data[0];
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      plan: planForPrice(item?.price.id) ?? undefined,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    },
  });
  clearBillingCache(shop.id);
}
