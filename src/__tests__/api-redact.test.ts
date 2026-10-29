import { describe, expect, it } from "vitest";
import { redactApiPayload } from "@/lib/api-redact";

describe("api response redaction", () => {
  it("removes customer portal tokens at any nesting depth", () => {
    const payload = {
      id: "job_1",
      customer: {
        id: "cus_1",
        firstName: "Ada",
        portalToken: "portal-secret",
        vehicles: [{ id: "veh_1", portalToken: "nested-secret" }],
      },
      jobs: [{ customer: { portalToken: "array-secret" } }],
    };

    const redacted = redactApiPayload(payload);
    expect(redacted.customer).not.toHaveProperty("portalToken");
    expect(redacted.customer.vehicles[0]).not.toHaveProperty("portalToken");
    expect(redacted.jobs[0].customer).not.toHaveProperty("portalToken");
    expect(redacted.customer.firstName).toBe("Ada");
  });

  it("removes password and 2FA secrets", () => {
    const redacted = redactApiPayload({
      user: {
        id: "usr_1",
        passwordHash: "hash",
        totpSecret: "otp",
        resetTokenHash: "reset",
        verificationToken: "verify",
      },
    });

    expect(redacted.user).toEqual({ id: "usr_1" });
  });

  it("does not remove legitimate portal URLs or setup secrets with other names", () => {
    const redacted = redactApiPayload({
      portalUrl: "https://example.test/portal/abc",
      secret: "totp-setup-secret",
      approvalToken: "approval",
    });

    expect(redacted).toEqual({
      portalUrl: "https://example.test/portal/abc",
      secret: "totp-setup-secret",
      approvalToken: "approval",
    });
  });

  it("leaves class instances such as Prisma Decimal values for the JSON serializer", () => {
    class DecimalLike {
      constructor(private readonly value: string) {}
      toJSON() {
        return this.value;
      }
    }
    const amount = new DecimalLike("12.34");

    const redacted = redactApiPayload({ amount, nested: { amount } });
    expect(redacted.amount).toBe(amount);
    expect(redacted.nested.amount).toBe(amount);
  });
});
