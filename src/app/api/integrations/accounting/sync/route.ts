import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { InvoiceStatus } from "@prisma/client";

type SyncInvoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: unknown;
  taxAmount: unknown;
  createdAt: Date;
  dueDate: Date | null;
  qbInvoiceId: string | null;
  customer: { firstName: string; lastName: string; email: string | null; company: string | null };
  lineItems: Array<{ description: string; quantity: unknown; unitPrice: unknown; total: unknown; type: string }>;
};

async function syncToQuickBooks(invoices: SyncInvoice[], tokens: { accessToken: string; realmId: string }) {
  const results = { synced: 0, failed: 0, errors: [] as string[] };

  for (const inv of invoices) {
    try {
      const qbInvoice = {
        DocNumber: inv.invoiceNumber,
        TxnDate: inv.createdAt.toISOString().slice(0, 10),
        DueDate: inv.dueDate?.toISOString().slice(0, 10) || undefined,
        CustomerRef: { name: `${inv.customer.firstName} ${inv.customer.lastName}` },
        Line: inv.lineItems.map((li) => ({
          DetailType: "SalesItemLineDetail",
          Amount: Number(li.total),
          Description: li.description,
          SalesItemLineDetail: { Qty: Number(li.quantity), UnitPrice: Number(li.unitPrice) },
        })),
        TxnTaxDetail: { TotalTax: Number(inv.taxAmount) },
      };

      const url = `https://quickbooks.api.intuit.com/v3/company/${tokens.realmId}/invoice`;
      const body = inv.qbInvoiceId
        ? { ...qbInvoice, Id: inv.qbInvoiceId, sparse: true }
        : qbInvoice;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        results.failed++;
        results.errors.push(`${inv.invoiceNumber}: ${res.status} ${errBody.slice(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const qbId = data?.Invoice?.Id as string | undefined;

      await prisma.invoice.update({
        where: { id: inv.id },
        data: { qbSyncedAt: new Date(), qbInvoiceId: qbId || inv.qbInvoiceId },
      });

      results.synced++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${inv.invoiceNumber}: ${String(err).slice(0, 100)}`);
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { platform, invoiceIds } = await req.json();
  if (!["quickbooks", "xero"].includes(platform)) return apiError("Invalid platform");

  const setting = await prisma.settings.findUnique({ where: { key: `${platform}_connection` } });
  const conn = setting?.value as Record<string, unknown> | null;

  if (!conn?.accessToken) {
    return apiError(`${platform === "quickbooks" ? "QuickBooks" : "Xero"} is not connected. Configure in Settings > Integrations.`);
  }

  const where = invoiceIds?.length
    ? { id: { in: invoiceIds as string[] } }
    : { status: { in: [InvoiceStatus.SENT, InvoiceStatus.PAID] }, qbSyncedAt: null };

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: { select: { firstName: true, lastName: true, email: true, company: true } },
      lineItems: true,
    },
    take: 50,
  });

  if (!invoices.length) return apiSuccess({ synced: 0, failed: 0, message: "No invoices to sync." });

  let results;

  if (platform === "quickbooks") {
    results = await syncToQuickBooks(invoices, {
      accessToken: conn.accessToken as string,
      realmId: conn.realmId as string,
    });
  } else {
    results = { synced: 0, failed: invoices.length, errors: ["Xero sync coming soon. Use CSV export for now."] };
  }

  await prisma.settings.update({
    where: { key: `${platform}_connection` },
    data: { value: { ...conn, lastSync: new Date().toISOString() } },
  });

  return apiSuccess(results);
}
