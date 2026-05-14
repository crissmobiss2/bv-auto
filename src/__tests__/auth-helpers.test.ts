import { describe, it, expect, vi, beforeEach } from "vitest";

describe("requireAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error response when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { requireAuth } = await import("@/lib/api-helpers");
    const result = await requireAuth();

    expect(result.error).not.toBeNull();
    expect(result.session).toBeNull();
    const res = result.error!;
    expect(res.status).toBe(401);
  });

  it("returns session when authenticated", async () => {
    const { requireAuth } = await import("@/lib/api-helpers");
    const result = await requireAuth();

    expect(result.error).toBeNull();
    expect(result.session?.user?.id).toBe("test-user");
  });
});

describe("requireRole", () => {
  it("denies access when role doesn't match", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "t", role: "TECHNICIAN", email: "t@t.com" },
    });

    const { requireRole } = await import("@/lib/api-helpers");
    const result = await requireRole(["ADMIN"]);

    expect(result.error).not.toBeNull();
    const res = result.error!;
    expect(res.status).toBe(403);
  });

  it("allows access when role matches", async () => {
    const { requireRole } = await import("@/lib/api-helpers");
    const result = await requireRole(["ADMIN"]);
    expect(result.error).toBeNull();
  });
});
