import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as Record<string, unknown>;
const shop = { count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
db.shop = shop;
db.$executeRaw = vi.fn(() => Promise.resolve(0));

const post = (body: object) =>
  new Request("http://localhost/api/shops", { method: "POST", body: JSON.stringify(body) });

describe("single-shop lock (AUTH-010 / DATA-001 option B)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the first shop as the default, under the advisory lock", async () => {
    shop.count.mockResolvedValue(0);
    shop.create.mockImplementation(({ data }) => Promise.resolve({ id: "s1", ...data }));
    const { POST } = await import("@/app/api/shops/route");
    const res = await POST(post({ name: "B&V" }) as never);
    expect(res.status).toBe(201);
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(shop.create.mock.calls[0][0].data.isDefault).toBe(true);
  });

  it("refuses a second shop", async () => {
    shop.count.mockResolvedValue(1);
    const { POST } = await import("@/app/api/shops/route");
    const res = await POST(post({ name: "Second" }) as never);
    expect(res.status).toBe(409);
    expect(shop.create).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the only shop", async () => {
    const { DELETE, PATCH } = await import("@/app/api/shops/[id]/route");
    const params = { params: Promise.resolve({ id: "s1" }) };
    expect((await DELETE(new Request("http://localhost") as never, params)).status).toBe(409);
    const patch = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ isActive: false }) });
    expect((await PATCH(patch as never, params)).status).toBe(409);
    expect(shop.update).not.toHaveBeenCalled();
  });
});
