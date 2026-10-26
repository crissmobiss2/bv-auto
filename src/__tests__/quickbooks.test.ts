import { describe, it, expect, vi } from "vitest";
import { pushInvoiceToQuickBooks, refreshQuickBooksToken } from "@/lib/quickbooks";

const inv = {
  invoiceNumber: "INV-2610-1234",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  dueDate: null,
  taxAmount: 5,
  qbInvoiceId: null,
  customer: { firstName: "Ann", lastName: "O'Neil", email: "ann@example.com", company: null },
  lineItems: [{ description: "Brake pads", quantity: 1, unitPrice: 100, total: 100 }],
};
const tokens = { accessToken: "t", realmId: "r1" };
const ok = (body: unknown) => ({ ok: true, json: async () => body, text: async () => "" }) as Response;

function qbMock(existingInvoice?: { Id: string; SyncToken: string }, existingCustomer?: string) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = decodeURIComponent(String(url));
    if (u.includes("FROM Invoice")) return ok({ QueryResponse: existingInvoice ? { Invoice: [existingInvoice] } : {} });
    if (u.includes("FROM Customer")) return ok({ QueryResponse: existingCustomer ? { Customer: [{ Id: existingCustomer }] } : {} });
    if (u.includes("/customer")) return ok({ Customer: { Id: "c-new" } });
    if (u.includes("/invoice")) return ok({ Invoice: { Id: JSON.parse(String(init?.body)).Id ?? "i-new" } });
    throw new Error(`unexpected ${u}`);
  });
}

describe("pushInvoiceToQuickBooks", () => {
  it("creates the customer and invoice when QuickBooks has neither", async () => {
    const f = qbMock();
    await expect(pushInvoiceToQuickBooks(inv, tokens, f as unknown as typeof fetch)).resolves.toBe("i-new");
    const invoiceCall = f.mock.calls.find(([u]) => String(u).includes("/invoice?"))!;
    const body = JSON.parse(String(invoiceCall[1]!.body));
    expect(body.Id).toBeUndefined();
    expect(body.CustomerRef).toEqual({ value: "c-new" });
    expect(decodeURIComponent(String(f.mock.calls[1][0]))).toContain("DisplayName = 'Ann O\\'Neil'");
  });

  it("updates the existing invoice with the same DocNumber instead of duplicating it", async () => {
    const f = qbMock({ Id: "i-9", SyncToken: "3" }, "c-1");
    await expect(pushInvoiceToQuickBooks(inv, tokens, f as unknown as typeof fetch)).resolves.toBe("i-9");
    const body = JSON.parse(String(f.mock.calls.find(([u]) => String(u).includes("/invoice?"))![1]!.body));
    expect(body).toMatchObject({ Id: "i-9", SyncToken: "3", sparse: true, CustomerRef: { value: "c-1" } });
    expect(f.mock.calls.some(([u]) => String(u).endsWith("/customer"))).toBe(false);
  });
});

describe("refreshQuickBooksToken", () => {
  it("keeps a valid token and refuses to refresh without credentials", async () => {
    const conn = { accessToken: "a", tokenExpiry: new Date(Date.now() + 3600_000).toISOString() };
    await expect(refreshQuickBooksToken(conn)).resolves.toBe(conn);
    await expect(refreshQuickBooksToken({ accessToken: "a", tokenExpiry: "2020-01-01" })).resolves.toBeNull();
  });
});
