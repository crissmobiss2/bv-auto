import { describe, expect, it } from "vitest";
import { currentShopId, openShopScope } from "@/lib/tenant";
import { requireAuth, requireRole } from "@/lib/api-helpers";

const tick = () => new Promise((r) => setTimeout(r, 1));

describe("shop context reaches the awaiting caller", () => {
  it("a scope opened before an await is visible after it resolves", async () => {
    const bind = async (id: string) => {
      const scope = openShopScope();
      await tick();
      scope.shopId = id;
    };
    await tick();
    await bind("shop_x");
    await tick();
    expect(currentShopId()).toBe("shop_x");
  });

  it("route handlers see the signed-in user's shop after requireAuth / requireRole", async () => {
    const handler = async (guard: () => Promise<unknown>) => {
      await tick();
      await guard();
      await tick();
      return currentShopId();
    };
    expect(await handler(requireAuth)).toBe("shop_1");
    expect(await handler(() => requireRole(["ADMIN"]))).toBe("shop_1");
  });
});
