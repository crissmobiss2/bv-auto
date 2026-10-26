import { prisma } from "@/lib/prisma";
import { currentShopId } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { PLANS } from "@/lib/billing";

export type PlanLimits = { users: number; texts: number; ai: number };

const MONTH_MS = 32 * 86_400_000;
const month = () => new Date().toISOString().slice(0, 7);

export const SMS_LIMIT_MESSAGE = "This shop has used its text allowance for this month. Upgrade on the Billing page to send more.";

/** A shop's monthly allowances: its plan's, Pro's during the trial, and no caps for exempt shops. */
export async function planLimits(shopId: string): Promise<PlanLimits> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { plan: true, billingExempt: true } });
  if (!shop || shop.billingExempt) {
    return { users: Infinity, texts: Infinity, ai: Number(process.env.AI_MONTHLY_LIMIT) || 2000 };
  }
  const plan = PLANS.find((p) => p.id === shop.plan) ?? PLANS.find((p) => p.id === "pro")!;
  return { users: plan.users, texts: plan.textsMonthly, ai: plan.aiMonthly };
}

/** Counts one outbound text against the shop's monthly allowance; false once it is used up. */
export async function takeSmsQuota(shopId: string | null | undefined = currentShopId()) {
  if (!shopId) return true;
  const { texts } = await planLimits(shopId);
  if (!Number.isFinite(texts)) return true;
  return rateLimit(`sms:${shopId}:${month()}`, texts, MONTH_MS, { durable: true });
}

/** Counts one AI request against the shop's monthly allowance; false once it is used up. */
export async function takeAiQuota(shopId: string) {
  return rateLimit(`ai:${shopId}:${month()}`, (await planLimits(shopId)).ai, MONTH_MS, { durable: true });
}

/** Why the current shop can't add another active staff user, or null if it can. */
export async function staffSeatError(shopId: string | null | undefined = currentShopId()) {
  if (!shopId) return null;
  const { users } = await planLimits(shopId);
  if (!Number.isFinite(users)) return null;
  const active = await prisma.user.count({ where: { shopId, isActive: true, role: { not: "CUSTOMER" } } });
  return active >= users ? `Your plan includes ${users} staff users. Upgrade on the Billing page to add more.` : null;
}
