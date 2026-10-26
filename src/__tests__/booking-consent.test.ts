import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const sms = vi.hoisted(() => ({ sendBookingConfirmationSMS: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/sms", () => ({ smsConfigured: true, ...sms }));
vi.mock("@/lib/email", () => ({ emailConfigured: false, sendBookingConfirmationEmail: vi.fn() }));
vi.mock("@/lib/push", () => ({ sendPushToUser: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => true), getIP: vi.fn(() => "1.1.1.1") }));
const shops = vi.hoisted(() => ({ resolvePublicShop: vi.fn() }));
vi.mock("@/lib/public-shop", () => shops);

import { POST } from "@/app/api/booking/route";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, unknown>;
db.serviceRequest = { create: vi.fn() };
db.user = { findMany: vi.fn() };
db.notification = { createMany: vi.fn(() => Promise.resolve({ count: 0 })) };
const body = { name: "Jane Doe", phone: "7135550100", serviceType: "Brakes", description: "Squeal" };
const post = (extra: object) =>
  POST(new NextRequest("http://x/api/booking", { method: "POST", body: JSON.stringify({ ...body, ...extra }) }));

describe("booking SMS consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m(prisma.customer.findFirst).mockResolvedValue(null);
    shops.resolvePublicShop.mockResolvedValue({ id: "shop_1" });
    m(prisma.serviceRequest.create).mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: "req_abcdef123", ...data }));
    m(prisma.user.findMany).mockResolvedValue([]);
  });

  it("does not text a customer who did not tick the consent box", async () => {
    const res = await post({});
    expect(res.status).toBe(201);
    expect(sms.sendBookingConfirmationSMS).not.toHaveBeenCalled();
    expect(m(prisma.serviceRequest.create).mock.calls[0][0].data).toMatchObject({ smsConsent: false, smsConsentAt: null });
  });

  it("texts and records the consent time when the box is ticked", async () => {
    await post({ smsConsent: true });
    expect(sms.sendBookingConfirmationSMS).toHaveBeenCalledOnce();
    expect(m(prisma.serviceRequest.create).mock.calls[0][0].data.smsConsentAt).toBeInstanceOf(Date);
  });

  it("rejects a booking link for an unknown shop", async () => {
    shops.resolvePublicShop.mockResolvedValue(null);
    const res = await post({ shop: "no-such-shop" });
    expect(res.status).toBe(404);
    expect(shops.resolvePublicShop).toHaveBeenCalledWith("no-such-shop");
    expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
  });

  it("silently drops bot submissions (honeypot or instant submit)", async () => {
    for (const extra of [{ website: "http://spam.example" }, { elapsedMs: 500 }]) {
      const res = await post(extra);
      expect(res.status).toBe(201);
    }
    expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
  });
});
