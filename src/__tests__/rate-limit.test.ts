import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// Re-import fresh module each test via dynamic import to reset module-level state
describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  it("allows requests under the limit (in-memory fallback)", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("db down"));
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(await rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(await rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(await rateLimit("test-key", 3, 60_000)).toBe(true);
  });

  it("blocks requests over the limit (in-memory fallback)", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("db down"));
    const { rateLimit } = await import("@/lib/rate-limit");
    await rateLimit("block-key", 2, 60_000);
    await rateLimit("block-key", 2, 60_000);
    expect(await rateLimit("block-key", 2, 60_000)).toBe(false);
  });

  it("isolates different keys", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("db down"));
    const { rateLimit } = await import("@/lib/rate-limit");
    await rateLimit("key-a", 1, 60_000);
    expect(await rateLimit("key-b", 1, 60_000)).toBe(true);
  });

  it("uses the shared database counter when available", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: 2 }] as never);
    expect(await rateLimit("db-key", 2, 60_000)).toBe(true);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: 3 }] as never);
    expect(await rateLimit("db-key", 2, 60_000)).toBe(false);
  });
});
