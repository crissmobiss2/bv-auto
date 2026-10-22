import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { sendInvoiceSMS, smsConfigured } from "@/lib/sms";
import { createInvoiceCheckoutSession } from "@/lib/stripe";
import { formatCurrency } from "@/lib/utils";
import { NotificationType } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  void req;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
    },
  });

  if (!invoice) return apiError("Invoice not found", 404);
  if (Number(invoice.amountDue) <= 0) return apiError("Invoice already paid");
  if (!invoice.customer.phone) return apiError("Customer has no phone number on file");
  if (!smsConfigured) return apiError("SMS isn't configured (missing Twilio credentials), so the text was not sent", 503);

  let payUrl: string | null = invoice.stripePaymentUrl;

  if (!payUrl) {
    try {
      const session = await createInvoiceCheckoutSession({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amountDue: Number(invoice.amountDue),
        customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        customerEmail: invoice.customer.email || undefined,
        description: `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model} — ${invoice.invoiceNumber}`,
      });
      await prisma.invoice.update({
        where: { id },
        data: { stripeSessionId: session.id, stripePaymentUrl: session.url },
      });
      payUrl = session.url ?? null;
    } catch {
      payUrl = null;
    }
  }

  const sms = await sendInvoiceSMS({
    to: invoice.customer.phone,
    customerName: invoice.customer.firstName,
    invoiceNumber: invoice.invoiceNumber,
    amountDue: formatCurrency(Number(invoice.amountDue)),
    paymentUrl: payUrl || undefined,
  });

  if (!sms) return apiError("Text was not sent", 502);

  await prisma.communication.create({
    data: {
      customerId: invoice.customerId,
      type: NotificationType.SMS,
      direction: "OUTBOUND",
      body: `Text-to-Pay sent for invoice ${invoice.invoiceNumber} — ${formatCurrency(Number(invoice.amountDue))} due`,
      status: "sent",
    },
  });

  return apiSuccess({ sent: true, phone: invoice.customer.phone });
}
