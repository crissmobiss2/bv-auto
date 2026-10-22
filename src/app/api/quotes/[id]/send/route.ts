import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { sendQuoteEmail, emailConfigured } from "@/lib/email";
import { sendQuoteSMS, smsConfigured } from "@/lib/sms";
import { formatCurrency } from "@/lib/utils";
import { AuditAction } from "@prisma/client";
import { randomBytes } from "crypto";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
    },
  });

  if (!quote) return apiError("Quote not found", 404);

  const token = randomBytes(32).toString("hex");
  const vehicleDesc = `${quote.job.vehicle.year} ${quote.job.vehicle.make} ${quote.job.vehicle.model}`;
  const totalStr = formatCurrency(Number(quote.totalAmount));

  await prisma.quote.update({
    where: { id },
    data: {
      approvalToken: token,
      status: "SENT",
      sentAt: new Date(),
    },
  });

  type Delivery = "sent" | "no_contact" | "not_configured" | "failed";

  let emailStatus: Delivery = "no_contact";
  if (quote.customer.email) {
    if (!emailConfigured) emailStatus = "not_configured";
    else {
      const res = await sendQuoteEmail({
        to: quote.customer.email,
        customerName: `${quote.customer.firstName} ${quote.customer.lastName}`,
        quoteNumber: quote.quoteNumber,
        vehicleDescription: vehicleDesc,
        totalAmount: totalStr,
        approvalToken: token,
      }).catch(() => null);
      emailStatus = res && !res.error ? "sent" : "failed";
    }
  }

  let smsStatus: Delivery = "no_contact";
  if (quote.customer.phone) {
    if (!smsConfigured) smsStatus = "not_configured";
    else {
      const res = await sendQuoteSMS({
        to: quote.customer.phone,
        customerName: quote.customer.firstName,
        quoteNumber: quote.quoteNumber,
        totalAmount: totalStr,
        approvalToken: token,
      }).catch(() => null);
      smsStatus = res ? "sent" : "failed";
    }
  }

  const emailSent = emailStatus === "sent";
  const smsSent = smsStatus === "sent";

  await logAudit(session!.user.id, AuditAction.EMAIL_SENT, "Quote", id, null, { token, emailStatus, smsStatus });

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
  return apiSuccess({
    approvalUrl: `${BASE_URL}/approve/${token}`,
    emailSent,
    smsSent,
    emailStatus,
    smsStatus,
  });
}
