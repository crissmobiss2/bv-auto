import { describe, expect, it, vi, beforeEach } from "vitest";

const rl = vi.hoisted(() => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => rl);
vi.mock("@/lib/tenant", () => ({ currentShopId: () => "shop_1" }));
const db = vi.hoisted(() => ({ prisma: { shop: { findUnique: vi.fn() } } }));
vi.mock("@/lib/prisma", () => db);

import { hashResetToken, passwordSchema } from "@/lib/password";
import { cappedFetch } from "@/lib/ai-client";

describe("passwordSchema", () => {
  it("rejects short, common and single-character passwords", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("Password123").success).toBe(false);
    expect(passwordSchema.safeParse("aaaaaaaaaa").success).toBe(false);
    expect(passwordSchema.safeParse("brake-rotor-42").success).toBe(true);
  });
});

describe("hashResetToken", () => {
  it("never stores the emailed token itself", () => {
    expect(hashResetToken("abc")).not.toBe("abc");
    expect(hashResetToken("abc")).toHaveLength(64);
  });
});

describe("cappedFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.shop.findUnique.mockResolvedValue({ plan: "starter", billingExempt: false });
  });
  it("answers 429 without calling Anthropic once the shop's monthly cap is used", async () => {
    rl.rateLimit.mockResolvedValue(false);
    const real = vi.spyOn(globalThis, "fetch");
    const res = await cappedFetch("https://api.anthropic.com/v1/messages", { method: "POST" });
    expect(res.status).toBe(429);
    expect(res.headers.get("x-should-retry")).toBe("false");
    expect(real).not.toHaveBeenCalled();
    expect(rl.rateLimit).toHaveBeenCalledWith(expect.stringMatching(/^ai:shop_1:\d{4}-\d{2}$/), 50, expect.any(Number));
  });
});
