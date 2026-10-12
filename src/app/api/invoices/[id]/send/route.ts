import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { sendInvoiceEmail, emailConfigured } from "@/lib/email";
import { sendInvoiceSMS, smsConfigured } from "@/lib/sms";
import { formatCurrency } from "@/lib/utils";
import { AuditAction } from "@prisma/client";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
    },
  });

  if (!invoice) return apiError("Invoice not found", 404);

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
  // Customers can't open staff-only dashboard pages — send them to their
  // tokenized portal when one exists so the link actually works for them.
  const invoiceUrl = invoice.customer.portalToken
    ? `${BASE_URL}/portal/${invoice.customer.portalToken}`
    : `${BASE_URL}/invoices/${id}`;
  const vehicleDesc = `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model}`;
  const amountDue = formatCurrency(Number(invoice.amountDue));
  const totalAmount = formatCurrency(Number(invoice.totalAmount));

  let emailSent = false;
  let emailError: string | undefined;
  if (invoice.customer.email) {
    if (!emailConfigured) {
      emailError = "Email not configured (missing RESEND_API_KEY)";
    } else {
      try {
        await sendInvoiceEmail({
          to: invoice.customer.email,
          customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
          invoiceNumber: invoice.invoiceNumber,
          vehicleDescription: vehicleDesc,
          totalAmount,
          amountDue,
          invoiceUrl,
          paymentUrl: invoice.stripePaymentUrl || undefined,
        });
        emailSent = true;
      } catch (e) {
        emailError = e instanceof Error ? e.message : "Email failed to send";
      }
    }
  }

  let smsSent = false;
  let smsError: string | undefined;
  if (invoice.customer.phone) {
    if (!smsConfigured) {
      smsError = "SMS not configured (missing Twilio credentials)";
    } else {
      try {
        await sendInvoiceSMS({
          to: invoice.customer.phone,
          customerName: invoice.customer.firstName,
          invoiceNumber: invoice.invoiceNumber,
          amountDue,
          paymentUrl: invoice.stripePaymentUrl || undefined,
        });
        smsSent = true;
      } catch (e) {
        smsError = e instanceof Error ? e.message : "SMS failed to send";
      }
    }
  }

  await prisma.invoice.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });

  await logAudit(session!.user.id, AuditAction.EMAIL_SENT, "Invoice", id, null, { emailSent, smsSent });

  return apiSuccess({
    emailSent,
    smsSent,
    emailError,
    smsError,
    emailTo: invoice.customer.email || null,
    smsTo: invoice.customer.phone || null,
    customerUrl: invoiceUrl,
  });
}