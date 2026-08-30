import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError } from "@/lib/api-helpers";
import { formatCurrency, formatDate } from "@/lib/utils";

// Escape user-controlled values before interpolating into the served HTML —
// this document is returned as text/html and rendered in the browser.
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, shopId },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { receivedAt: "desc" } },
    },
  });

  if (!invoice) return apiError("Invoice not found", 404);

  // Generate HTML-based PDF
  const html = generateInvoiceHTML(invoice);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${esc(invoice.invoiceNumber)}.html"`,
    },
  });
}

function generateInvoiceHTML(invoice: {
  invoiceNumber: string;
  status: string;
  createdAt: Date;
  dueDate?: Date | null;
  notes?: string | null;
  subtotal: unknown;
  taxRate: unknown;
  taxAmount: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
  amountPaid: unknown;
  amountDue: unknown;
  customer: {
    firstName: string;
    lastName: string;
    company?: string | null;
    phone: string;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  job: {
    vehicle: { year: number; make: string; model: string; vin?: string | null };
  };
  lineItems: {
    type: string;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    total: unknown;
    taxable: boolean;
  }[];
  payments: { method: string; amount: unknown; receivedAt: Date }[];
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${invoice.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; background: white; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .company { }
  .company h1 { font-size: 24px; font-weight: 700; color: #1d4ed8; }
  .company p { color: #6b7280; font-size: 13px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 20px; font-weight: 600; }
  .invoice-meta .number { font-size: 14px; color: #6b7280; }
  .invoice-meta .status { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #166534; margin-top: 4px; }
  .billing { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .billing-block h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 8px; }
  .billing-block p { font-size: 14px; color: #374151; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f9fafb; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
  .totals { max-width: 300px; margin-left: auto; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #374151; }
  .totals-total { display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: 700; border-top: 2px solid #e5e7eb; margin-top: 8px; }
  .totals-due { display: flex; justify-content: space-between; padding: 6px 0; font-size: 16px; font-weight: 600; color: #d97706; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="company">
    <h1>B&V Mobile Auto</h1>
    <p>Mobile Automotive Repair</p>
    <p>Phone: (555) 000-0000</p>
    <p>bvauto@email.com</p>
  </div>
  <div class="invoice-meta">
    <h2>INVOICE</h2>
    <p class="number">${invoice.invoiceNumber}</p>
    <span class="status">${esc(invoice.status)}</span>
    <p style="margin-top:8px;font-size:13px;color:#6b7280;">Date: ${formatDate(invoice.createdAt)}</p>
    ${invoice.dueDate ? `<p style="font-size:13px;color:#6b7280;">Due: ${formatDate(invoice.dueDate)}</p>` : ""}
  </div>
</div>

<div class="billing">
  <div class="billing-block">
    <h3>Bill To</h3>
    <p><strong>${esc(invoice.customer.firstName)} ${esc(invoice.customer.lastName)}</strong></p>
    ${invoice.customer.company ? `<p>${esc(invoice.customer.company)}</p>` : ""}
    <p>${esc(invoice.customer.phone)}</p>
    ${invoice.customer.email ? `<p>${esc(invoice.customer.email)}</p>` : ""}
    ${invoice.customer.address ? `<p>${esc(invoice.customer.address)}, ${esc(invoice.customer.city || "")} ${esc(invoice.customer.state || "")} ${esc(invoice.customer.zip || "")}</p>` : ""}
  </div>
  <div class="billing-block">
    <h3>Vehicle</h3>
    <p><strong>${invoice.job.vehicle.year} ${esc(invoice.job.vehicle.make)} ${esc(invoice.job.vehicle.model)}</strong></p>
    ${invoice.job.vehicle.vin ? `<p>VIN: ${esc(invoice.job.vehicle.vin)}</p>` : ""}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Type</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Unit Price</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${invoice.lineItems.map((li) => `
    <tr>
      <td>${esc(li.description)}</td>
      <td style="color:#9ca3af;font-size:12px">${esc(li.type)}</td>
      <td style="text-align:center">${li.quantity}</td>
      <td style="text-align:right">${formatCurrency(Number(li.unitPrice))}</td>
      <td style="text-align:right;font-weight:500">${formatCurrency(Number(li.total))}</td>
    </tr>`).join("")}
  </tbody>
</table>

<div class="totals">
  <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(Number(invoice.subtotal))}</span></div>
  ${Number(invoice.taxAmount) > 0 ? `<div class="totals-row"><span>Tax (${Number(invoice.taxRate)}%)</span><span>${formatCurrency(Number(invoice.taxAmount))}</span></div>` : ""}
  ${Number(invoice.discountAmount) > 0 ? `<div class="totals-row" style="color:#16a34a"><span>Discount</span><span>-${formatCurrency(Number(invoice.discountAmount))}</span></div>` : ""}
  <div class="totals-total"><span>Total</span><span>${formatCurrency(Number(invoice.totalAmount))}</span></div>
  ${Number(invoice.amountPaid) > 0 ? `<div class="totals-row" style="color:#16a34a"><span>Paid</span><span>${formatCurrency(Number(invoice.amountPaid))}</span></div>` : ""}
  <div class="totals-due"><span>Balance Due</span><span>${formatCurrency(Number(invoice.amountDue))}</span></div>
</div>

${invoice.notes ? `<div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;font-size:13px;color:#374151"><strong>Notes:</strong> ${esc(invoice.notes)}</div>` : ""}

<div class="footer">
  <p>Thank you for choosing B&V Mobile Auto! · For questions call (555) 000-0000</p>
</div>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}
