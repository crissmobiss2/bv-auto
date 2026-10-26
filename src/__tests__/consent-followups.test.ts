import { describe, expect, it } from "vitest";
import { mergedFields } from "@/lib/customer-merge";
import { marketableSms } from "@/lib/consent";

const base = { id: "t", tags: [], notes: null, smsOptOut: false, smsOptOutAt: null, marketingOptOut: false, taxExempt: false };

describe("SMS consent follow-ups", () => {
  it("merge keeps the source's recorded consent when both share the phone number", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    const target = { ...base, phone: "(555) 123-4567", smsConsentAt: null };
    expect(mergedFields(target, { ...base, id: "s", phone: "+15551234567", smsConsentAt: at }).smsConsentAt).toBe(at);
    expect(mergedFields(target, { ...base, id: "s", phone: "5559999999", smsConsentAt: at }).smsConsentAt).toBeUndefined();
  });

  it("merge keeps the target's own consent date", () => {
    const own = new Date("2026-09-01T00:00:00Z");
    const data = mergedFields({ ...base, smsConsentAt: own }, { ...base, id: "s", smsConsentAt: new Date() });
    expect(data.smsConsentAt).toBeUndefined();
  });

  it("marketing texts require recorded consent", () => {
    expect(marketableSms).toMatchObject({ smsOptOut: false, marketingOptOut: false, smsConsentAt: { not: null } });
  });
});
