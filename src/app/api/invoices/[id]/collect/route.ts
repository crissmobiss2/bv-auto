import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { createInvoiceCheckoutSession } from "@/lib/stripe";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
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
  if (Number(invoice.amountDue) <= 0) return apiError("Invoice already paid");

  // Reuse existing session if still valid
  if (invoice.stripePaymentUrl && invoice.stripeSessionId) {
    return apiSuccess({ url: invoice.stripePaymentUrl, sessionId: invoice.stripeSessionId });
  }

  const session = await createInvoiceCheckoutSession({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amountDue: Number(invoice.amountDue),
    customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
    customerEmail: invoice.customer.email ?? undefined,
    description: `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model} — ${invoice.invoiceNumber}`,
  });

  await prisma.invoice.update({
    where: { id },
    data: {
      stripeSessionId: session.id,
      stripePaymentUrl: session.url,
    },
  });

  return apiSuccess({ url: session.url, sessionId: session.id });
}
