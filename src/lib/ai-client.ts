import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { currentShopId } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { PLANS } from "@/lib/billing";

const UNPLANNED_LIMIT = Number(process.env.AI_MONTHLY_LIMIT) || 2000;

/** AI requests a shop may make per calendar month: its plan's allowance (trial = Pro). */
export async function aiMonthlyLimit(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { plan: true, billingExempt: true } });
  if (!shop || shop.billingExempt) return UNPLANNED_LIMIT;
  return (PLANS.find((p) => p.id === shop.plan) ?? PLANS.find((p) => p.id === "pro")!).aiMonthly;
}

/** Counts every Anthropic API call against the current shop's monthly cap. */
export const cappedFetch: typeof fetch = async (input, init) => {
  const shopId = currentShopId();
  if (shopId) {
    const month = new Date().toISOString().slice(0, 7);
    if (!(await rateLimit(`ai:${shopId}:${month}`, await aiMonthlyLimit(shopId), 32 * 86_400_000))) {
      return new Response(
        JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "This shop has used its AI allowance for this month." } }),
        { status: 429, headers: { "content-type": "application/json", "x-should-retry": "false" } },
      );
    }
  }
  return fetch(input, init);
};

export const createAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: cappedFetch });
