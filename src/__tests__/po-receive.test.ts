import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/api-helpers", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-helpers")>()),
  requireRole: vi.fn(() => Promise.resolve({ error: null, session: { user: { id: "u1", shopId: "shop_1" } } })),
  logAudit: vi.fn(() => Promise.resolve()),
}));

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function line(id: string, status: string, quantity: number, quantityReceived: number) {
  return { id, description: id, status, quantity, quantityReceived };
}

async function receive(items: { partId: string; quantity: number }[]) {
  const { POST } = await import("@/app/api/purchase-orders/[id]/receive/route");
  const req = new NextRequest("http://x/api/purchase-orders/po1/receive", { method: "POST", body: JSON.stringify({ items }) });
  return POST(req, { params: Promise.resolve({ id: "po1" }) });
}

describe("PO partial receive", () => {
  beforeEach(() => {
    db.purchaseOrder = { findUnique: vi.fn(), update: vi.fn((a) => Promise.resolve(a)) };
    db.jobPart = { update: vi.fn(() => Promise.resolve({})) };
  });

  it("keeps the order open while an INSTALLED line still has units outstanding", async () => {
    db.purchaseOrder.findUnique.mockResolvedValue({
      id: "po1", status: "CONFIRMED",
      items: [line("a", "INSTALLED", 2, 1), line("b", "ORDERED", 1, 0)],
    });
    const res = await receive([{ partId: "b", quantity: 1 }]);
    expect(res.status).toBe(200);
    expect(db.purchaseOrder.update.mock.calls[0][0].data).toEqual({ status: "CONFIRMED" });
  });

  it("closes the order when every line is fully in, without un-installing a part", async () => {
    db.purchaseOrder.findUnique.mockResolvedValue({
      id: "po1", status: "CONFIRMED",
      items: [line("a", "INSTALLED", 2, 1), line("b", "RETURNED", 1, 0)],
    });
    await receive([{ partId: "a", quantity: 1 }]);
    expect(db.jobPart.update.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(db.purchaseOrder.update.mock.calls[0][0].data).toMatchObject({ status: "RECEIVED" });
  });

  it("refuses more than is outstanding", async () => {
    db.purchaseOrder.findUnique.mockResolvedValue({ id: "po1", status: "SENT", items: [line("a", "ORDERED", 2, 1)] });
    const res = await receive([{ partId: "a", quantity: 2 }]);
    expect(res.status).toBe(400);
    expect(db.jobPart.update).not.toHaveBeenCalled();
  });
});
