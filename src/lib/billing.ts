import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export type PlanId = "starter" | "pro" | "shop_plus" | "founding";

export const PLANS: { id: PlanId; name: string; price: number; priceEnv: string; features: string[] }[] = [
  { id: "starter", name: "Starter", price: 79, priceEnv: "STRIPE_PRICE_STARTER", features: ["3 users", "500 texts / month", "50 AI diagnoses / month"] },
  { id: "pro", name: "Pro", price: 149, priceEnv: "STRIPE_PRICE_PRO", features: ["10 users", "2,000 texts / month", "300 AI diagnoses / month"] },
  { id: "shop_plus", name: "Shop+", price: 249, priceEnv: "STRIPE_PRICE_SHOP_PLUS", features: ["Unlimited users", "5,000 texts / month", "1,000 AI diagnoses / month"] },
  { id: "founding", name: "Founding Pro", price: 99, priceEnv: "STRIPE_PRICE_FOUNDING", features: ["Everything in Pro", "Price locked for 12 months", "First 20 shops only"] },
];

export const TRIAL_DAYS = 14;
export const FOUNDING_LIMIT = 20;

export const priceIdFor = (plan: string) => process.env[PLANS.find((p) => p.id === plan)?.priceEnv ?? ""] || null;
export const planForPrice = (priceId?: string | null) =>
  (priceId && PLANS.find((p) => process.env[p.priceEnv] === priceId)?.id) || null;

/** The platform's own Stripe account, separate from STRIPE_SECRET_KEY (the shop's customer payments). */
export const platformStripe = process.env.PLATFORM_STRIPE_SECRET_KEY
  ? new Stripe(process.env.PLATFORM_STRIPE_SECRET_KEY)
  : null;

export const baseUrl = () => process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";

type BillingFields = { billingExempt: boolean; subscriptionStatus: string | null; trialEndsAt: Date | null };
export type BillingState = "exempt" | "active" | "grace" | "trial" | "locked";

export function billingState(s: BillingFields, now = new Date()): BillingState {
  if (s.billingExempt) return "exempt";
  if (s.subscriptionStatus === "active" || s.subscriptionStatus === "trialing") return "active";
  // Stripe retries a failed renewal, then moves the subscription to canceled/unpaid.
  if (s.subscriptionStatus === "past_due") return "grace";
  if (s.trialEndsAt && now < s.trialEndsAt) return "trial";
  return "locked";
}

export const billingSelect = { billingExempt: true, subscriptionStatus: true, trialEndsAt: true } as const;

const cache = new Map<string, { locked: boolean; at: number }>();
export const clearBillingCache = (shopId?: string | null) => (shopId ? cache.delete(shopId) : cache.clear());

/** Locked shops stay readable (view, export) but cannot change anything until they subscribe. */
export async function isShopLocked(shopId: string) {
  const hit = cache.get(shopId);
  if (hit && Date.now() - hit.at < 60_000) return hit.locked;
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: billingSelect });
  const locked = shop ? billingState(shop) === "locked" : false;
  cache.set(shopId, { locked, at: Date.now() });
  return locked;
}
