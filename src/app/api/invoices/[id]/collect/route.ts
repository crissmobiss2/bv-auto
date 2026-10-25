import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { createInvoiceCheckoutSession, getReusableCheckoutUrl } from "@/lib/stripe";

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

  if (invoice.status === "VOID" || invoice.status === "REFUNDED") return apiError("Invoice is void or refunded");

  const reusable = await getReusableCheckoutUrl(invoice.stripeSessionId, Number(invoice.amountDue));
  if (reusable) return apiSuccess({ url: reusable, sessionId: invoice.stripeSessionId });

  let session;
  try {
    session = await createInvoiceCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: Number(invoice.amountDue),
      customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
      customerEmail: invoice.customer.email ?? undefined,
      description: `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model} — ${invoice.invoiceNumber}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create payment session";
    const hint = /not configured|api key|secret/i.test(msg)
      ? "Online card payments aren't set up yet. Add STRIPE_SECRET_KEY to your environment variables (Vercel → Settings → Environment Variables), then redeploy."
      : msg;
    return apiError(hint, 400);
  }

  await prisma.invoice.update({
    where: { id },
    data: {
      stripeSessionId: session.id,
      stripePaymentUrl: session.url,
    },
  });

  return apiSuccess({ url: session.url, sessionId: session.id });
}
