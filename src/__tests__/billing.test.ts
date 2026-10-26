import { describe, expect, it, vi } from "vitest";

vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
const { billingState, planForPrice, priceIdFor } = await import("@/lib/billing");

const base = { billingExempt: false, subscriptionStatus: null as string | null, trialEndsAt: null as Date | null };
const now = new Date("2026-11-01T00:00:00Z");

describe("billingState", () => {
  it("never locks exempt shops", () => {
    expect(billingState({ ...base, billingExempt: true, subscriptionStatus: "canceled" }, now)).toBe("exempt");
  });
  it("runs the free trial until trialEndsAt", () => {
    expect(billingState({ ...base, trialEndsAt: new Date("2026-11-02") }, now)).toBe("trial");
    expect(billingState({ ...base, trialEndsAt: new Date("2026-10-31") }, now)).toBe("locked");
  });
  it("follows the Stripe subscription status", () => {
    expect(billingState({ ...base, subscriptionStatus: "active" }, now)).toBe("active");
    expect(billingState({ ...base, subscriptionStatus: "trialing" }, now)).toBe("active");
    expect(billingState({ ...base, subscriptionStatus: "past_due" }, now)).toBe("grace");
    expect(billingState({ ...base, subscriptionStatus: "canceled" }, now)).toBe("locked");
    expect(billingState({ ...base, subscriptionStatus: "unpaid" }, now)).toBe("locked");
  });
  it("keeps an unfinished trial after an abandoned checkout", () => {
    expect(billingState({ ...base, subscriptionStatus: "incomplete_expired", trialEndsAt: new Date("2026-11-05") }, now)).toBe("trial");
  });
});

describe("plan prices", () => {
  it("maps plans to configured Stripe prices and back", () => {
    expect(priceIdFor("pro")).toBe("price_pro");
    expect(priceIdFor("starter")).toBeNull();
    expect(planForPrice("price_pro")).toBe("pro");
    expect(planForPrice("price_other")).toBeNull();
  });
});
