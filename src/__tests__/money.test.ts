import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { reconcileInvoice, roundMoney } from "@/lib/payments";

vi.mock("@/lib/stripe", () => ({ stripe: null }));
vi.mock("@/lib/push", () => ({ sendPushToRole: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/api-helpers", async (orig) => {
  const actual = await orig<typeof import("@/lib/api-helpers")>();
  return { ...actual, logAudit: vi.fn(() => Promise.resolve()) };
});

type Mock = ReturnType<typeof vi.fn>;
const m = (f: unknown) => f as Mock;

function fakeTx(invoice: Record<string, unknown>, payments: { amount: number; type: string }[]) {
  return {
    invoice: {
      findUniqueOrThrow: vi.fn(() => Promise.resolve(invoice)),
      update: vi.fn((args: { data: unknown }) => Promise.resolve({ ...invoice, ...(args.data as object) })),
    },
    payment: { findMany: vi.fn(() => Promise.resolve(payments)) },
    job: { update: vi.fn(), updateMany: vi.fn() },
  };
}

describe("reconcileInvoice", () => {
  const base = { id: "inv", totalAmount: 100, jobId: "job", paidAt: null };

  it("marks fully paid invoices PAID and the job PAID", async () => {
    const tx = fakeTx({ ...base, status: "SENT" }, [{ amount: 60, type: "PAYMENT" }, { amount: 40, type: "DEPOSIT" }]);
    const r = await reconcileInvoice(tx as never, "inv");
    expect(r.status).toBe("PAID");
    expect(r.amountDue).toBe(0);
    expect(tx.job.update).toHaveBeenCalled();
  });

  it("nets refunds: a partial refund reopens a PAID invoice as PARTIAL", async () => {
    const tx = fakeTx({ ...base, status: "PAID" }, [{ amount: 100, type: "PAYMENT" }, { amount: -30, type: "REFUND" }]);
    const r = await reconcileInvoice(tx as never, "inv");
    expect(r.status).toBe("PARTIAL");
    expect(r.totalPaid).toBe(70);
    expect(r.amountDue).toBe(30);
    expect(tx.job.updateMany).toHaveBeenCalled();
  });

  it("a full refund marks the invoice REFUNDED", async () => {
    const tx = fakeTx({ ...base, status: "PAID" }, [{ amount: 100, type: "PAYMENT" }, { amount: -100, type: "REFUND" }]);
    expect((await reconcileInvoice(tx as never, "inv")).status).toBe("REFUNDED");
  });

  it("never reopens a VOID invoice", async () => {
    const tx = fakeTx({ ...base, status: "VOID" }, []);
    expect((await reconcileInvoice(tx as never, "inv")).status).toBe("VOID");
  });

  it("rounds to cents", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
  });
});

describe("refund route", () => {
  beforeEach(() => vi.clearAllMocks());
  const req = (body: unknown) =>
    new Request("http://localhost/api/invoices/inv/refund", { method: "POST", body: JSON.stringify(body) });
  const params = { params: Promise.resolve({ id: "inv" }) };

  it("rejects a refund larger than the refundable amount", async () => {
    const { POST } = await import("@/app/api/invoices/[id]/refund/route");
    m(prisma.payment.findUnique)
      .mockResolvedValueOnce(null) // idempotency replay lookup
      .mockResolvedValueOnce({ id: "p1", invoiceId: "inv", amount: 50, type: "PAYMENT", method: "CASH", refunds: [{ amount: -20 }] });
    const res = await POST(req({ paymentId: "p1", amount: 40, idempotencyKey: "key-12345" }) as never, params);
    expect(res.status).toBe(400);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("replays an already-processed idempotency key without a second refund", async () => {
    const { POST } = await import("@/app/api/invoices/[id]/refund/route");
    m(prisma.payment.findUnique).mockResolvedValueOnce({ id: "r1", amount: -10, invoiceId: "inv", refundOfId: "p1" });
    const res = await POST(req({ paymentId: "p1", amount: 10, idempotencyKey: "key-12345" }) as never, params);
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key that belongs to another invoice's refund", async () => {
    const { POST } = await import("@/app/api/invoices/[id]/refund/route");
    m(prisma.payment.findUnique).mockResolvedValueOnce({ id: "r9", amount: -10, invoiceId: "other", refundOfId: "p9" });
    const res = await POST(req({ paymentId: "p1", amount: 10, idempotencyKey: "key-12345" }) as never, params);
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toContain("r9");
  });

  it("records a cash refund as a negative REFUND row", async () => {
    const { POST } = await import("@/app/api/invoices/[id]/refund/route");
    const original = { id: "p1", invoiceId: "inv", amount: 50, type: "PAYMENT", method: "CASH", refunds: [] };
    m(prisma.payment.findUnique).mockResolvedValueOnce(null).mockResolvedValue(original);
    m(prisma.payment.create).mockResolvedValue({ id: "r1", amount: -20 });
    m(prisma.invoice.findUniqueOrThrow).mockResolvedValue({ id: "inv", totalAmount: 50, status: "PAID", jobId: "j", paidAt: null });
    m(prisma.payment.findMany).mockResolvedValue([{ amount: 50, type: "PAYMENT" }, { amount: -20, type: "REFUND" }]);
    m(prisma.invoice.update).mockResolvedValue({ id: "inv", status: "PARTIAL" });
    const res = await POST(req({ paymentId: "p1", amount: 20, idempotencyKey: "key-12345" }) as never, params);
    expect(res.status).toBe(200);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: -20, type: "REFUND", refundOfId: "p1" }) }),
    );
  });
});

describe("manual payment", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = { params: Promise.resolve({ id: "inv" }) };
  const patch = (body: unknown) =>
    new Request("http://localhost/api/invoices/inv", { method: "PATCH", body: JSON.stringify(body) });

  it("returns the existing payment for a replayed idempotency key", async () => {
    const { PATCH } = await import("@/app/api/invoices/[id]/route");
    m(prisma.invoice.findUnique).mockResolvedValue({ id: "inv", status: "SENT", amountDue: 100, totalAmount: 100, payments: [] });
    m(prisma.payment.findUnique).mockResolvedValueOnce({ id: "p1", amount: 100, invoiceId: "inv" });
    const res = await PATCH(patch({ action: "payment", amount: 100, method: "CASH", idempotencyKey: "key-12345" }) as never, params);
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key that belongs to another invoice's payment", async () => {
    const { PATCH } = await import("@/app/api/invoices/[id]/route");
    m(prisma.invoice.findUnique).mockResolvedValue({ id: "inv", status: "SENT", amountDue: 100, totalAmount: 100, payments: [] });
    m(prisma.payment.findUnique).mockResolvedValueOnce({ id: "p9", amount: 100, invoiceId: "other" });
    const res = await PATCH(patch({ action: "payment", amount: 100, method: "CASH", idempotencyKey: "key-12345" }) as never, params);
    expect(res.status).toBe(409);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("refuses to void an invoice that still has payments", async () => {
    const { PATCH } = await import("@/app/api/invoices/[id]/route");
    m(prisma.invoice.findUnique).mockResolvedValue({ id: "inv", status: "PAID", amountPaid: 50, payments: [] });
    const res = await PATCH(patch({ status: "VOID" }) as never, params);
    expect(res.status).toBe(400);
  });
});
