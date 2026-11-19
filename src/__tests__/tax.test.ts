import { describe, expect, it } from "vitest";
import { calculateSalesTax, isTaxableLineItem, shopTaxRatePercent } from "@/lib/tax";

describe("parts-only sales tax", () => {
  it("taxes PART lines and leaves labor/service lines alone", () => {
    const result = calculateSalesTax(
      [
        { type: "LABOR", total: 100 },
        { type: "PART", total: 50 },
        { type: "FLUID", total: 20 },
      ],
      10.5,
    );
    expect(result.taxableAmount).toBe(50);
    expect(result.taxAmount).toBe(5.25);
  });

  it("handles decimal line totals without floating-point drift", () => {
    const result = calculateSalesTax([{ type: "PART", total: 19.99 }], 10.5);
    expect(result.taxAmount).toBe(2.1);
  });

  it("only marks PART as taxable", () => {
    expect(isTaxableLineItem("PART")).toBe(true);
    expect(isTaxableLineItem("LABOR")).toBe(false);
    expect(isTaxableLineItem("SHOP_SUPPLY")).toBe(false);
    expect(isTaxableLineItem("DISCOUNT")).toBe(false);
  });

  it("normalizes legacy shop tax values to 10.5 percent", () => {
    expect(shopTaxRatePercent(0.105)).toBe(10.5);
    expect(shopTaxRatePercent(0)).toBe(10.5);
    expect(shopTaxRatePercent(0.0825)).toBe(10.5);
    expect(shopTaxRatePercent(8.25)).toBe(10.5);
  });
});
