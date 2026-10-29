import { describe, expect, it } from "vitest";
import { redactPartForShopFloor } from "@/lib/part-visibility";

describe("part visibility", () => {
  it("removes vendor and margin fields from shop-floor part responses", () => {
    const part = {
      id: "part_1",
      description: "Front brake pads",
      status: "ORDERED",
      quantity: 1,
      unitCost: 40,
      unitPrice: 72,
      markup: 80,
      totalCost: 40,
      totalPrice: 72,
      coreCharge: 10,
      creditAmount: 5,
      vendor: { id: "vendor_1", name: "Parts Co" },
    };

    const redacted = redactPartForShopFloor(part);
    expect(redacted).toEqual({
      id: "part_1",
      description: "Front brake pads",
      status: "ORDERED",
      quantity: 1,
    });
  });

  it("keeps non-money fields used by the work order", () => {
    const redacted = redactPartForShopFloor({
      id: "part_2",
      partNumber: "BP-123",
      description: "Oil filter",
      quantity: 2,
      notes: "Use OEM",
    });

    expect(redacted).toEqual({
      id: "part_2",
      partNumber: "BP-123",
      description: "Oil filter",
      quantity: 2,
      notes: "Use OEM",
    });
  });
});
