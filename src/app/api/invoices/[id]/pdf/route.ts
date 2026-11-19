import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { getBranding } from "@/lib/shop";
import { openShopScope } from "@/lib/tenant";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { verifyInvoicePdfToken } from "@/lib/invoice-pdf-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = openShopScope();
  const tokenOk = verifyInvoicePdfToken(id, req.nextUrl.searchParams.get("token"));

  if (!tokenOk) {
    if (req.nextUrl.searchParams.has("token")) {
      return apiError("This PDF link is invalid or has expired", 401);
    }
    const { error } = await requireAuth();
    if (error) return error;
  } else {
    // A signed link can be opened outside the app, where the session cookie is
    // not present. Bind the request to the invoice's shop before reading it.
    const owner = await prisma.invoice.findUnique({ where: { id }, select: { shopId: true } });
    if (!owner) return apiError("Invoice not found", 404);
    if (owner.shopId) scope.shopId = owner.shopId;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { receivedAt: "asc" } },
    },
  });

  if (!invoice) return apiError("Invoice not found", 404);

  const brand = await getBranding();
  const pdf = await renderInvoicePdf(invoice, brand);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
