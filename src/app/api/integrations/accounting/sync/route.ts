import { shopSettingKey } from "@/lib/tenant";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiError, apiSuccess } from "@/lib/api-helpers";
import { pushInvoiceToQuickBooks, refreshQuickBooksToken, type QbSyncInvoice, type QbTokens } from "@/lib/quickbooks";
import { InvoiceStatus } from "@prisma/client";

const syncLockKey = (invoiceId: string) => `accounting-sync:${invoiceId}`;

async function syncToQuickBooks(invoices: (QbSyncInvoice & { id: string })[], tokens: QbTokens) {
  const results = { synced: 0, failed: 0, skipped: 0, errors: [] as string[] };

  for (const inv of invoices) {
    try {
      // Per-invoice lock: a second sync running at the same time skips this invoice
      // instead of racing it into a duplicate QuickBooks invoice.
      const outcome = await prisma.$transaction(
        async (tx) => {
          const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(hashtext(${syncLockKey(inv.id)})) AS locked`;
          if (!locked) return "skipped" as const;
          const qbId = await pushInvoiceToQuickBooks(inv, tokens);
          await tx.invoice.update({ where: { id: inv.id }, data: { qbSyncedAt: new Date(), qbInvoiceId: qbId } });
          return "synced" as const;
        },
        { timeout: 30_000, maxWait: 10_000 },
      );
      results[outcome]++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${inv.invoiceNumber}: ${String(err instanceof Error ? err.message : err).slice(0, 160)}`);
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const { platform, invoiceIds } = await req.json();
  if (!["quickbooks", "xero"].includes(platform)) return apiError("Invalid platform");

  const setting = await prisma.settings.findUnique({ where: { key: shopSettingKey(`${platform}_connection`) } });
  let conn = setting?.value as Record<string, unknown> | null;

  if (!conn?.accessToken) {
    return apiError(`${platform === "quickbooks" ? "QuickBooks" : "Xero"} is not connected. Configure in Settings > Integrations.`);
  }

  const where = invoiceIds?.length
    ? { id: { in: invoiceIds as string[] } }
    : {
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE, InvoiceStatus.PAID] },
        qbSyncedAt: null,
      };

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
    conn = await refreshQuickBooksToken(conn);
    if (!conn) return apiError("QuickBooks session expired. Reconnect it in Settings > Integrations.", 401);
    results = await syncToQuickBooks(invoices, {
      accessToken: conn.accessToken as string,
      realmId: conn.realmId as string,
    });
  } else {
    results = { synced: 0, failed: invoices.length, errors: ["Xero sync coming soon. Use CSV export for now."] };
  }

  await prisma.settings.update({
    where: { key: shopSettingKey(`${platform}_connection`) },
    data: { value: { ...conn, lastSync: new Date().toISOString() } },
  });

  return apiSuccess(results);
}
