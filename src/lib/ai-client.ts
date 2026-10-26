import Anthropic from "@anthropic-ai/sdk";
import { currentShopId } from "@/lib/tenant";
import { planLimits, takeAiQuota } from "@/lib/plan-limits";

/** AI requests a shop may make per calendar month: its plan's allowance (trial = Pro). */
export async function aiMonthlyLimit(shopId: string) {
  return (await planLimits(shopId)).ai;
}

/** Counts every Anthropic API call against the current shop's monthly cap. */
export const cappedFetch: typeof fetch = async (input, init) => {
  const shopId = currentShopId();
  if (shopId) {
    if (!(await takeAiQuota(shopId))) {
      return new Response(
        JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "This shop has used its AI allowance for this month." } }),
        { status: 429, headers: { "content-type": "application/json", "x-should-retry": "false" } },
      );
    }
  }
  return fetch(input, init);
};

export const createAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: cappedFetch });
