import { describe, it, expect } from "vitest";
import { parseShopDate } from "@/lib/timezone";
import { formatDate } from "@/lib/utils";
import { redactAuditPayload } from "@/lib/audit-redact";

describe("parseShopDate", () => {
  it("keeps a date-only value on the same calendar day in the shop", () => {
    expect(formatDate(parseShopDate("2026-10-30"))).toBe("Oct 30, 2026");
  });
  it("passes full timestamps through", () => {
    expect(parseShopDate("2026-10-30T12:00:00Z").toISOString()).toBe("2026-10-30T12:00:00.000Z");
  });
});

describe("redactAuditPayload depth", () => {
  it("redacts credentials nested deeper than six levels", () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { password: "hunter2" } } } } } } } };
    expect(JSON.stringify(redactAuditPayload(deep))).not.toContain("hunter2");
  });
});
