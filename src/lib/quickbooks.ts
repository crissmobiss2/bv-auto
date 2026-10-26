// QuickBooks Online invoice push, idempotent by DocNumber (FIN-007).

export type QbTokens = { accessToken: string; realmId: string };
type Fetch = typeof fetch;

export type QbSyncInvoice = {
  invoiceNumber: string;
  createdAt: Date;
  dueDate: Date | null;
  taxAmount: unknown;
  qbInvoiceId: string | null;
  customer: { firstName: string; lastName: string; email: string | null; company: string | null };
  lineItems: Array<{ description: string; quantity: unknown; unitPrice: unknown; total: unknown }>;
};

const base = (t: QbTokens) => `https://quickbooks.api.intuit.com/v3/company/${t.realmId}`;
const qbString = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function qb(t: QbTokens, path: string, init: RequestInit | undefined, f: Fetch) {
  const res = await f(`${base(t)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`QuickBooks ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

const query = (t: QbTokens, sql: string, f: Fetch) =>
  qb(t, `/query?query=${encodeURIComponent(sql)}&minorversion=65`, undefined, f);

export const customerDisplayName = (c: QbSyncInvoice["customer"]) =>
  (c.company || `${c.firstName} ${c.lastName}`).trim().slice(0, 100);

async function findOrCreateCustomer(t: QbTokens, c: QbSyncInvoice["customer"], f: Fetch): Promise<string> {
  const name = customerDisplayName(c);
  const found = await query(t, `SELECT Id FROM Customer WHERE DisplayName = '${qbString(name)}'`, f);
  const id = found?.QueryResponse?.Customer?.[0]?.Id;
  if (id) return id;
  const created = await qb(t, "/customer", {
    method: "POST",
    body: JSON.stringify({
      DisplayName: name,
      GivenName: c.firstName,
      FamilyName: c.lastName,
      CompanyName: c.company || undefined,
      PrimaryEmailAddr: c.email ? { Address: c.email } : undefined,
    }),
  }, f);
  return created.Customer.Id;
}

/**
 * Creates the invoice, or sparse-updates the one QuickBooks already has with this DocNumber,
 * so a retried or repeated sync never creates a duplicate. Returns the QuickBooks invoice id.
 */
export async function pushInvoiceToQuickBooks(inv: QbSyncInvoice, t: QbTokens, f: Fetch = fetch): Promise<string> {
  const existing = (
    await query(t, `SELECT Id, SyncToken FROM Invoice WHERE DocNumber = '${qbString(inv.invoiceNumber)}'`, f)
  )?.QueryResponse?.Invoice?.[0] as { Id: string; SyncToken: string } | undefined;

  const payload = {
    DocNumber: inv.invoiceNumber,
    TxnDate: inv.createdAt.toISOString().slice(0, 10),
    DueDate: inv.dueDate?.toISOString().slice(0, 10) || undefined,
    CustomerRef: { value: await findOrCreateCustomer(t, inv.customer, f) },
    Line: inv.lineItems.map((li) => ({
      DetailType: "SalesItemLineDetail",
      Amount: Number(li.total),
      Description: li.description,
      SalesItemLineDetail: { Qty: Number(li.quantity), UnitPrice: Number(li.unitPrice) },
    })),
    TxnTaxDetail: { TotalTax: Number(inv.taxAmount) },
  };
  const body = existing ? { ...payload, Id: existing.Id, SyncToken: existing.SyncToken, sparse: true } : payload;
  const data = await qb(t, "/invoice?minorversion=65", { method: "POST", body: JSON.stringify(body) }, f);
  return data.Invoice.Id;
}

/** Refreshes an expired access token. Returns the updated connection, or null if refresh isn't possible. */
export async function refreshQuickBooksToken(conn: Record<string, unknown>, f: Fetch = fetch) {
  const expiry = conn.tokenExpiry ? new Date(String(conn.tokenExpiry)).getTime() : 0;
  if (expiry - 60_000 > Date.now()) return conn;
  const id = process.env.QUICKBOOKS_CLIENT_ID;
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!id || !secret || !conn.refreshToken) return null;
  const res = await f("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: String(conn.refreshToken) }),
  });
  if (!res.ok) return null;
  const tokens = await res.json();
  return {
    ...conn,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? conn.refreshToken,
    tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
}
