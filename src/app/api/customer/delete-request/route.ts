import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, logAudit, apiError } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "crissmobiss@gmail.com";
const FROM = "B&V Mobile Auto <service@bvauto.com>";

export async function POST() {
  const { error, session } = await requireRole(["CUSTOMER"]);
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { customerId: true, name: true, email: true },
  });

  if (!user?.customerId) {
    return apiError("No customer record linked to your account", 404);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: user.customerId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (!customer) {
    return apiError("Customer record not found", 404);
  }

  const customerName = `${customer.firstName} ${customer.lastName}`;
  const requestedAt = new Date().toISOString();

  const emailHtml = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">CCPA Deletion Request</h1>
    <p style="color:#fca5a5;margin:4px 0 0;font-size:13px;">B&amp;V Mobile Auto — Action Required</p>
  </div>
  <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>A customer has submitted a CCPA data deletion request. You must process this within <strong>30 days</strong> per California law.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 0;font-size:13px;color:#6b7280;width:140px;">Customer Name</td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;">${customerName}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 0;font-size:13px;color:#6b7280;">Email</td>
        <td style="padding:8px 0;font-size:13px;">${customer.email || "N/A"}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 0;font-size:13px;color:#6b7280;">Customer ID</td>
        <td style="padding:8px 0;font-family:monospace;font-size:12px;">${customer.id}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#6b7280;">Requested At</td>
        <td style="padding:8px 0;font-size:13px;">${requestedAt}</td>
      </tr>
    </table>
    <div style="background:#fef2f2;border:1px solid #fecaca;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#991b1b;font-weight:600;">Required Actions:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#991b1b;">
        <li>Delete or anonymize all personal data for this customer</li>
        <li>Remove associated vehicles, jobs, invoices, communications, and SMS records</li>
        <li>Confirm deletion to the customer within 30 days of ${requestedAt}</li>
        <li>Deadline: ${new Date(Date.now() + 30 * 86400000).toDateString()}</li>
      </ul>
    </div>
  </div>
</body>
</html>`;

  if (resend) {
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `CCPA Delete Request — ${customerName}`,
      html: emailHtml,
    });
  } else {
    console.log(`[EMAIL STUB] CCPA Delete Request — ${customerName} (${customer.id}) at ${requestedAt}`);
  }

  await logAudit(
    session!.user.id,
    AuditAction.UPDATE,
    "Customer",
    customer.id,
    null,
    null,
    `CCPA deletion request submitted by customer at ${requestedAt}`
  );

  return NextResponse.json({
    ok: true,
    message: "Your deletion request has been received. We will process it within 30 days.",
  });
}
