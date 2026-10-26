import { describe, it, expect } from "vitest";
import { redactAuditPayload, looksLikeBot } from "@/lib/audit-redact";

describe("redactAuditPayload", () => {
  it("redacts credentials at any depth and keeps ordinary fields", () => {
    const out = redactAuditPayload({
      name: "Ann",
      email: "ann@example.com",
      passwordHash: "$2b$...",
      portalToken: "abc",
      settings: { qb: { accessToken: "x", refreshToken: "y", realmId: "1" } },
      items: [{ apiKey: "k", notes: "ok" }],
      resetToken: null,
    });
    expect(out).toEqual({
      name: "Ann",
      email: "ann@example.com",
      passwordHash: "[redacted]",
      portalToken: "[redacted]",
      settings: { qb: { accessToken: "[redacted]", refreshToken: "[redacted]", realmId: "1" } },
      items: [{ apiKey: "[redacted]", notes: "ok" }],
      resetToken: null,
    });
  });
});

describe("looksLikeBot", () => {
  it("treats previewers, scanners, HEAD and missing UA as bots", () => {
    expect(looksLikeBot("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
    expect(looksLikeBot("facebookexternalhit/1.1")).toBe(true);
    expect(looksLikeBot("WhatsApp/2.23.20.0")).toBe(true);
    expect(looksLikeBot(null)).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "HEAD")).toBe(true);
  });
  it("lets real browsers through", () => {
    expect(
      looksLikeBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    ).toBe(false);
    expect(looksLikeBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")).toBe(false);
  });
});
