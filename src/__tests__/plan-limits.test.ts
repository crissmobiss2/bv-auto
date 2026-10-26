import { describe, expect, it, vi, beforeEach } from "vitest";

const rl = vi.hoisted(() => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => rl);
vi.mock("@/lib/tenant", () => ({ currentShopId: () => "shop_1" }));
const db = vi.hoisted(() => ({ prisma: { shop: { findUnique: vi.fn() }, user: { count: vi.fn() } } }));
vi.mock("@/lib/prisma", () => db);

import { planLimits, staffSeatError, takeSmsQuota } from "@/lib/plan-limits";

describe("plan limits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the plan's allowances, Pro during the trial, and none for exempt shops", async () => {
    db.prisma.shop.findUnique.mockResolvedValueOnce({ plan: "starter", billingExempt: false });
    expect(await planLimits("shop_1")).toMatchObject({ users: 3, texts: 500, ai: 50 });
    db.prisma.shop.findUnique.mockResolvedValueOnce({ plan: null, billingExempt: false });
    expect(await planLimits("shop_1")).toMatchObject({ users: 10, texts: 2000 });
    db.prisma.shop.findUnique.mockResolvedValueOnce({ plan: "starter", billingExempt: true });
    expect((await planLimits("shop_1")).users).toBe(Infinity);
  });

  it("blocks a new staff user once the plan's seats are full", async () => {
    db.prisma.shop.findUnique.mockResolvedValue({ plan: "starter", billingExempt: false });
    db.prisma.user.count.mockResolvedValueOnce(2);
    expect(await staffSeatError()).toBeNull();
    db.prisma.user.count.mockResolvedValueOnce(3);
    expect(await staffSeatError()).toMatch(/3 staff users/);
    expect(db.prisma.user.count).toHaveBeenCalledWith({ where: { shopId: "shop_1", isActive: true, role: { not: "CUSTOMER" } } });
  });

  it("counts texts against the shared monthly counter and never caps exempt shops", async () => {
    db.prisma.shop.findUnique.mockResolvedValueOnce({ plan: "pro", billingExempt: false });
    rl.rateLimit.mockResolvedValueOnce(false);
    expect(await takeSmsQuota()).toBe(false);
    expect(rl.rateLimit).toHaveBeenCalledWith(expect.stringMatching(/^sms:shop_1:\d{4}-\d{2}$/), 2000, expect.any(Number), { durable: true });
    db.prisma.shop.findUnique.mockResolvedValueOnce({ plan: null, billingExempt: true });
    expect(await takeSmsQuota()).toBe(true);
    expect(rl.rateLimit).toHaveBeenCalledTimes(1);
  });
});
