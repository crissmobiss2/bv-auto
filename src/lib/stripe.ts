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
