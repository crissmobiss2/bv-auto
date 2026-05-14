import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { InvoiceStatus } from "@prisma/client";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const [qbSetting, xeroSetting] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "quickbooks_connection" } }),
    prisma.settings.findUnique({ where: { key: "xero_connection" } }),
  ]);

  const qb = qbSetting?.value as Record<string, unknown> | null;
  const xero = xeroSetting?.value as Record<string, unknown> | null;

  const [syncedCount, pendingCount] = await Promise.all([
    prisma.invoice.count({ where: { qbSyncedAt: { not: null } } }),
    prisma.invoice.count({ where: { status: { in: [InvoiceStatus.SENT, InvoiceStatus.PAID] }, qbSyncedAt: null } }),
  ]);

  return apiSuccess({
    quickbooks: {
      connected: !!qb?.accessToken,
      companyName: qb?.companyName || null,
      realmId: qb?.realmId || null,
      lastSync: qb?.lastSync || null,
      tokenExpiry: qb?.tokenExpiry || null,
    },
    xero: {
      connected: !!xero?.accessToken,
      tenantName: xero?.tenantName || null,
      lastSync: xero?.lastSync || null,
    },
    stats: { syncedCount, pendingCount },
  });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { platform } = await req.json();
  if (!["quickbooks", "xero"].includes(platform)) return apiError("Invalid platform");

  await prisma.settings.deleteMany({ where: { key: `${platform}_connection` } });
  return apiSuccess({ disconnected: true });
}
