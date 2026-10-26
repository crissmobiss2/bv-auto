import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/public-shop";

describe("slugify", () => {
  it("makes URL-safe shop keys", () => {
    expect(slugify("B&V Mobile Auto")).toBe("b-v-mobile-auto");
    expect(slugify("  Joe's  Garage!! ")).toBe("joe-s-garage");
    expect(slugify("***")).toBe("shop");
    expect(slugify("a".repeat(60))).toHaveLength(40);
  });
});
