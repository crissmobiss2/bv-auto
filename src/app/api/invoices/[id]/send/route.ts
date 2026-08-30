import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { sendInvoiceEmail } from "@/lib/email";
import { sendInvoiceSMS } from "@/lib/sms";
import { formatCurrency } from "@/lib/utils";
import { AuditAction } from "@prisma/client";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, shopId },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
    },
  });

  if (!invoice) return apiError("Invoice not found", 404);

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
  const invoiceUrl = `${BASE_URL}/invoices/${id}`;
  const vehicleDesc = `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model}`;
  const amountDue = formatCurrency(Number(invoice.amountDue));
  const totalAmount = formatCurrency(Number(invoice.totalAmount));

  const emailSent = invoice.customer.email
    ? await sendInvoiceEmail({
        to: invoice.customer.email,
        customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        invoiceNumber: invoice.invoiceNumber,
        vehicleDescription: vehicleDesc,
        totalAmount,
        amountDue,
        invoiceUrl,
        paymentUrl: invoice.stripePaymentUrl || undefined,
      }).catch(() => null)
    : null;

  const smsSent = invoice.customer.phone
    ? await sendInvoiceSMS({
        to: invoice.customer.phone,
        customerName: invoice.customer.firstName,
        invoiceNumber: invoice.invoiceNumber,
        amountDue,
        paymentUrl: invoice.stripePaymentUrl || undefined,
      }).catch(() => null)
    : null;

  await prisma.invoice.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });

  await logAudit(session!.user.id, AuditAction.EMAIL_SENT, "Invoice", id, null, { emailSent: !!emailSent, smsSent: !!smsSent });

  return apiSuccess({ emailSent: !!emailSent, smsSent: !!smsSent });
}
