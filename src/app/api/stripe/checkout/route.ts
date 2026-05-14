import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { createInvoiceCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { invoiceId } = await req.json();
  if (!invoiceId) return apiError("invoiceId required");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
    },
  });

  if (!invoice) return apiError("Invoice not found", 404);
  if (Number(invoice.amountDue) <= 0) return apiError("Invoice has no balance due");

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
      where: { id: invoiceId },
      data: { stripeSessionId: session.id, stripePaymentUrl: session.url },
    });

    return apiSuccess({ url: session.url, sessionId: session.id });
  } catch {
    return apiError("Stripe is not configured. Add STRIPE_SECRET_KEY to enable online payments.", 503);
  }
}
