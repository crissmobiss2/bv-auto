import { describe, it, expect, beforeEach, vi } from "vitest";

// Re-import fresh module each test via dynamic import to reset module-level state
describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows requests under the limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
    expect(rateLimit("test-key", 3, 60_000)).toBe(true);
  });

  it("blocks requests over the limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    rateLimit("block-key", 2, 60_000);
    rateLimit("block-key", 2, 60_000);
    expect(rateLimit("block-key", 2, 60_000)).toBe(false);
  });

  it("isolates different keys", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    rateLimit("key-a", 1, 60_000);
    // key-a is exhausted, key-b should still work
    expect(rateLimit("key-b", 1, 60_000)).toBe(true);
  });
});
