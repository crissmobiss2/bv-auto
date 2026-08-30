import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "B&V Mobile Auto <service@bvauto.com>";
const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";

/** Escape user/customer-supplied text before interpolating into email HTML. */
function esc(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}`);
    return { id: "stub" };
  }
  return resend.emails.send({ from: FROM, to, subject, html });
}

function baseTemplate(content: string) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
    <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;">
      <h1 style="color:white;margin:0;font-size:20px;">B&amp;V Mobile Auto</h1>
      <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Mobile Automotive Repair</p>
    </div>
    <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      ${content}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">B&amp;V Mobile Auto · Houston, TX · service@bvauto.com</p>
  </body></html>`;
}

export async function sendQuoteEmail(opts: {
  to: string;
  customerName: string;
  quoteNumber: string;
  vehicleDescription: string;
  totalAmount: string;
  approvalToken: string;
}) {
  const approvalUrl = `${BASE_URL}/approve/${opts.approvalToken}`;
  const html = baseTemplate(`
    <h2 style="color:#1e3a5f;margin:0 0 8px;">Your Estimate is Ready</h2>
    <p>Hi ${esc(opts.customerName)},</p>
    <p>Your estimate for your <strong>${esc(opts.vehicleDescription)}</strong> is ready for review.</p>
    <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Quote #${opts.quoteNumber}</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#1e3a5f;">${opts.totalAmount}</p>
    </div>
    <a href="${approvalUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 0;">Review &amp; Approve Estimate</a>
    <p style="color:#6b7280;font-size:13px;">You can approve or decline this estimate. No account required.</p>
    <p style="color:#6b7280;font-size:13px;">Questions? Call us at (555) 000-1000</p>
  `);
  return send(opts.to, `Your Estimate is Ready — ${opts.quoteNumber}`, html);
}

export async function sendInvoiceEmail(opts: {
  to: string;
  customerName: string;
  invoiceNumber: string;
  vehicleDescription: string;
  totalAmount: string;
  amountDue: string;
  invoiceUrl: string;
  paymentUrl?: string;
}) {
  const html = baseTemplate(`
    <h2 style="color:#1e3a5f;margin:0 0 8px;">Invoice for Service</h2>
    <p>Hi ${esc(opts.customerName)},</p>
    <p>Thank you for choosing B&amp;V Mobile Auto! Your invoice for service on your <strong>${esc(opts.vehicleDescription)}</strong> is attached.</p>
    <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Invoice #${opts.invoiceNumber}</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#1e3a5f;">${opts.amountDue} due</p>
    </div>
    ${opts.paymentUrl ? `<a href="${opts.paymentUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 0;">Pay Now Online</a>` : ""}
    <a href="${opts.invoiceUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 4px;">View Invoice</a>
    <p style="color:#6b7280;font-size:13px;">We accept cash, check, card, Zelle, Venmo &amp; CashApp.</p>
  `);
  return send(opts.to, `Invoice ${opts.invoiceNumber} — ${opts.amountDue} due`, html);
}

export async function sendInspectionEmail(opts: {
  to: string;
  customerName: string;
  vehicleDescription: string;
  inspectionHtml: string;
  jobId: string;
}) {
  const html = baseTemplate(`
    <h2 style="color:#1e3a5f;margin:0 0 8px;">Vehicle Inspection Report</h2>
    <p>Hi ${esc(opts.customerName)},</p>
    <p>Here is the inspection report for your <strong>${esc(opts.vehicleDescription)}</strong>:</p>
    <div style="margin:16px 0;">${opts.inspectionHtml}</div>
    <p style="color:#6b7280;font-size:13px;">Questions? Call us at (555) 000-1000</p>
  `);
  return send(opts.to, `Vehicle Inspection Report — ${esc(opts.vehicleDescription)}`, html);
}

export async function sendPaymentReceiptEmail(opts: {
  to: string;
  customerName: string;
  invoiceNumber: string;
  amountPaid: string;
  method: string;
}) {
  const html = baseTemplate(`
    <h2 style="color:#16a34a;margin:0 0 8px;">✓ Payment Received</h2>
    <p>Hi ${esc(opts.customerName)},</p>
    <p>We received your payment. Thank you!</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Invoice #${opts.invoiceNumber}</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#16a34a;">${opts.amountPaid} paid</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">via ${esc(opts.method)}</p>
    </div>
    <p>Thank you for your business! We look forward to serving you again.</p>
  `);
  return send(opts.to, `Payment Received — Invoice ${opts.invoiceNumber}`, html);
}

export async function sendFollowUpEmail(opts: {
  to: string;
  customerName: string;
  message: string;
}) {
  const html = baseTemplate(`
    <p>Hi ${esc(opts.customerName)},</p>
    <p>${esc(opts.message)}</p>
    <p>To schedule service, call us at <strong>(555) 000-1000</strong> or reply to this email.</p>
  `);
  return send(opts.to, "Service Reminder from B&V Mobile Auto", html);
}
