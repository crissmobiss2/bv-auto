import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createDepositCheckoutSession, createInvoiceCheckoutSession, getReusableCheckoutUrl, stripe } from "@/lib/stripe";

const schema = z.union([
  z.object({ invoiceId: z.string().min(1) }),
  z.object({ quoteId: z.string().min(1) }),
]);

// Customer-facing "Pay now": the portal token proves the customer; the
// invoice/quote must belong to that customer. Always returns a live session.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!rateLimit(`portal-pay:${token}`, 20, 10 * 60_000)) return apiError("Too many requests", 429);
  if (!stripe) return apiError("Online payments are not available right now. Please call the shop.", 503);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invoiceId or quoteId is required", 400);

  const customer = await prisma.customer.findUnique({ where: { portalToken: token }, select: { id: true, email: true } });
  if (!customer) return apiError("Portal link not found", 404);

  if ("quoteId" in parsed.data) {
    const quote = await prisma.quote.findFirst({ where: { id: parsed.data.quoteId, customerId: customer.id } });
    if (!quote) return apiError("Quote not found", 404);
    const required = Number(quote.depositRequired ?? 0);
    const owed = Math.round((required - Number(quote.depositPaid ?? 0)) * 100) / 100;
    if (required <= 0 || owed <= 0) return apiError("No deposit is due on this quote", 400);
    if (["DECLINED", "EXPIRED", "CONVERTED"].includes(quote.status)) return apiError("This quote is closed", 400);
    const session = await createDepositCheckoutSession({
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      amount: owed,
      customerEmail: customer.email ?? undefined,
      returnPath: `/portal/${token}`,
    });
    return apiSuccess({ url: session.url });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: parsed.data.invoiceId, customerId: customer.id },
    include: { customer: true, job: { include: { vehicle: true } } },
  });
  if (!invoice) return apiError("Invoice not found", 404);
  if (["VOID", "REFUNDED", "DRAFT"].includes(invoice.status)) return apiError("This invoice cannot be paid online", 400);
  const amountDue = Number(invoice.amountDue);
  if (amountDue <= 0) return apiError("This invoice is already paid", 400);

  const reusable = await getReusableCheckoutUrl(invoice.stripeSessionId, amountDue);
  if (reusable) return apiSuccess({ url: reusable });

  try {
    const session = await createInvoiceCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountDue,
      customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
      customerEmail: invoice.customer.email ?? undefined,
      description: `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model} — ${invoice.invoiceNumber}`,
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { stripeSessionId: session.id, stripePaymentUrl: session.url } });
    return apiSuccess({ url: session.url });
  } catch (e) {
    console.error("Portal checkout failed:", e);
    return apiError("Could not start the payment. Please try again or call the shop.", 502);
  }
}
