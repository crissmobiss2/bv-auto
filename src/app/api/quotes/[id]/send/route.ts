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
  if (["APPROVED", "DECLINED", "CONVERTED"].includes(quote.status)) {
    return apiError(
      "This quote has already been approved, declined, or converted and cannot be resent.",
      409,
    );
  }

  const token = randomBytes(32).toString("hex");
  const vehicleDesc = `${quote.job.vehicle.year} ${quote.job.vehicle.make} ${quote.job.vehicle.model}`;
  const totalStr = formatCurrency(Number(quote.totalAmount));

  const canEmail = !!quote.customer.email && emailConfigured;
  const canSms = !!quote.customer.phone && smsConfigured;
  if (!canEmail && !canSms) {
    return apiError(
      "Quote not sent: email/SMS is not configured, or the customer has no usable contact method.",
      503,
    );
  }

  let emailSent = false;
  let emailError: string | undefined;
  if (canEmail) {
    try {
      await sendQuoteEmail({
        to: quote.customer.email!,
        customerName: `${quote.customer.firstName} ${quote.customer.lastName}`,
        quoteNumber: quote.quoteNumber,
        vehicleDescription: vehicleDesc,
        totalAmount: totalStr,
        approvalToken: token,
      });
      emailSent = true;
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Email failed to send";
    }
  }

  let smsSent = false;
  let smsError: string | undefined;
  if (canSms) {
    try {
      await sendQuoteSMS({
        to: quote.customer.phone!,
        customerName: quote.customer.firstName,
        quoteNumber: quote.quoteNumber,
        totalAmount: totalStr,
        approvalToken: token,
      });
      smsSent = true;
    } catch (e) {
      smsError = e instanceof Error ? e.message : "SMS failed to send";
    }
  }

  // Never claim a quote was sent when every delivery attempt failed.
  if (!emailSent && !smsSent) {
    await logAudit(session!.user.id, AuditAction.EMAIL_SENT, "Quote", id, null, {
      token,
      emailSent,
      smsSent,
      emailError,
      smsError,
    });
    return apiError(
      `Quote was not sent. ${emailError || smsError || "No delivery channel succeeded."}`,
      502,
    );
  }

  await prisma.quote.update({
    where: { id },
    data: {
      approvalToken: token,
      status: "SENT",
      sentAt: new Date(),
    },
  });

  await logAudit(session!.user.id, AuditAction.EMAIL_SENT, "Quote", id, null, { token, emailSent, smsSent });

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
  return apiSuccess({
    approvalUrl: `${BASE_URL}/approve/${token}`,
    emailSent,
    smsSent,
    emailError,
    smsError,
  });
}
