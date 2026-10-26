import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { mergeCustomers, mergedFields, phoneKey } from "@/lib/customer-merge";

const base = { tags: [] as string[], notes: null, smsOptOut: false, smsOptOutAt: null, marketingOptOut: false, taxExempt: false };

describe("customer merge", () => {
  it("normalizes phones to the last 10 digits", () => {
    expect(phoneKey("+1 (555) 123-4567")).toBe("5551234567");
    expect(phoneKey("555.123.4567")).toBe("5551234567");
  });

  it("keeps target values, fills blanks, unions tags and keeps any opt-out", () => {
    const data = mergedFields(
      { ...base, id: "t", email: "t@x.com", city: null, tags: ["fleet"] },
      { ...base, id: "s", email: "s@x.com", city: "Fresno", tags: ["vip", "fleet"], smsOptOut: true, marketingOptOut: true, notes: "gate code 12" },
    );
    expect(data.email).toBeUndefined();
    expect(data).toMatchObject({ city: "Fresno", tags: ["fleet", "vip"], smsOptOut: true, marketingOptOut: true, notes: "gate code 12" });
  });

  it("moves every related record and deactivates the source", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const models = ["vehicle", "job", "quote", "invoice", "note", "communication", "followUp", "serviceRequest", "smsMessage", "reviewRequest", "declinedService", "warranty", "commEnrollment", "user"];
    const tx = Object.fromEntries(models.map((m) => [m, { updateMany }])) as Record<string, unknown>;
    const update = vi.fn().mockResolvedValue({});
    tx.customer = { update };
    const moved = await mergeCustomers(tx as unknown as Prisma.TransactionClient, { ...base, id: "t" }, { ...base, id: "s" });
    expect(moved).toBe(models.length * 2);
    expect(updateMany).toHaveBeenCalledWith({ where: { customerId: "s" }, data: { customerId: "t" } });
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "s" }, data: expect.objectContaining({ isActive: false, portalToken: null }) }));
  });
});
