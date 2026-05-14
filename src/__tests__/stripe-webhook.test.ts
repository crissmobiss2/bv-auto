import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock Stripe
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendPaymentReceiptEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/sms", () => ({
  sendPaymentReceivedSMS: vi.fn(() => Promise.resolve()),
}));

describe("Stripe webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests with missing signature", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
      // No stripe-signature header
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("rejects when webhook secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "test-sig" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("processes checkout.session.completed and marks invoice paid", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "test-secret";

    const { stripe } = await import("@/lib/stripe");
    (stripe!.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { invoiceId: "inv-123" },
          amount_total: 29900,
          payment_intent: "pi_test",
        },
      },
    });

    const mockInvoice = {
      id: "inv-123",
      invoiceNumber: "INV-001",
      customer: { email: "test@test.com", phone: "5551234567", firstName: "Jane", lastName: "Smith" },
    };

    (prisma.invoice.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockInvoice);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([{}, {}]);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "valid-sig", "Content-Type": "text/plain" },
    });

    const res = await POST(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
