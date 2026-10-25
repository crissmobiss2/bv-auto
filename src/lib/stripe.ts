import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function createInvoiceCheckoutSession(opts: {
  invoiceId: string;
  invoiceNumber: string;
  amountDue: number;
  customerName: string;
  customerEmail?: string;
  description: string;
}) {
  if (!stripe) throw new Error("Stripe not configured");

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice ${opts.invoiceNumber}`,
            description: opts.description,
          },
          unit_amount: Math.round(opts.amountDue * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: opts.customerEmail,
    metadata: {
      invoiceId: opts.invoiceId,
      invoiceNumber: opts.invoiceNumber,
    },
    success_url: `${BASE_URL}/invoices/${opts.invoiceId}?paid=1`,
    cancel_url: `${BASE_URL}/invoices/${opts.invoiceId}`,
  });

  return session;
}

/**
 * Checkout sessions expire (24h) and are priced at creation. Only reuse a stored
 * session while it is still open, not near expiry, and for the current balance.
 */
export async function getReusableCheckoutUrl(sessionId: string | null, amountDue: number): Promise<string | null> {
  if (!stripe || !sessionId) return null;
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    const fresh = s.expires_at * 1000 > Date.now() + 10 * 60_000;
    const sameAmount = s.amount_total === Math.round(amountDue * 100);
    return s.status === "open" && fresh && sameAmount && s.url ? s.url : null;
  } catch {
    return null;
  }
}

export async function createDepositCheckoutSession(opts: {
  quoteId: string;
  quoteNumber: string;
  amount: number;
  customerEmail?: string;
  returnPath: string;
}) {
  if (!stripe) throw new Error("Stripe not configured");
  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
  return stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `Deposit for quote ${opts.quoteNumber}` },
        unit_amount: Math.round(opts.amount * 100),
      },
      quantity: 1,
    }],
    mode: "payment",
    customer_email: opts.customerEmail,
    metadata: { type: "deposit", quoteId: opts.quoteId, quoteNumber: opts.quoteNumber },
    success_url: `${BASE_URL}${opts.returnPath}?deposit=1`,
    cancel_url: `${BASE_URL}${opts.returnPath}`,
  });
}
