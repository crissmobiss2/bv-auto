import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseSmsKeyword, phoneVariants, assertSmsAllowed, SmsOptedOutError, setSmsOptOut } from "@/lib/consent";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("parseSmsKeyword", () => {
  it("recognises carrier opt-out keywords regardless of case and punctuation", () => {
    expect(parseSmsKeyword("stop")).toBe("STOP");
    expect(parseSmsKeyword(" Unsubscribe! ")).toBe("STOP");
    expect(parseSmsKeyword("START")).toBe("START");
    expect(parseSmsKeyword("help")).toBe("HELP");
  });
  it("ignores normal messages that merely contain a keyword", () => {
    expect(parseSmsKeyword("please stop by tomorrow")).toBeNull();
    expect(parseSmsKeyword("Can you start the car?")).toBeNull();
  });
});

describe("phoneVariants", () => {
  it("covers raw, E.164 and 10-digit forms", () => {
    expect(phoneVariants("+1 (713) 555-0100")).toEqual(expect.arrayContaining(["+17135550100", "7135550100"]));
  });
});

describe("SMS consent enforcement", () => {
  beforeEach(() => vi.clearAllMocks());
  it("blocks sending to an opted-out number", async () => {
    m(prisma.customer.findFirst).mockResolvedValueOnce({ id: "c1" });
    await expect(assertSmsAllowed("7135550100")).rejects.toBeInstanceOf(SmsOptedOutError);
  });
  it("allows sending when nobody on the number opted out", async () => {
    m(prisma.customer.findFirst).mockResolvedValueOnce(null);
    await expect(assertSmsAllowed("7135550100")).resolves.toBeUndefined();
  });
  it("STOP marks every customer on the number opted out", async () => {
    m(prisma.customer.updateMany).mockResolvedValueOnce({ count: 2 });
    await setSmsOptOut("+17135550100", true);
    const arg = m(prisma.customer.updateMany).mock.calls[0][0];
    expect(arg.data.smsOptOut).toBe(true);
    expect(arg.data.smsOptOutAt).toBeInstanceOf(Date);
    expect(JSON.stringify(arg.where)).toContain("7135550100");
  });
});
