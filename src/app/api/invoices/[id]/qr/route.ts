import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError } from "@/lib/api-helpers";
import QRCode from "qrcode";
import { createInvoiceCheckoutSession } from "@/lib/stripe";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
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
  if (Number(invoice.amountDue) <= 0) return apiError("Invoice already paid");

  let payUrl = invoice.stripePaymentUrl;

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
      payUrl = session.url;
    } catch {
      return apiError("Stripe not configured. Add STRIPE_SECRET_KEY to enable QR payments.", 503);
    }
  }

  const qrBuffer = await QRCode.toBuffer(payUrl!, {
    type: "png",
    width: 300,
    margin: 2,
    color: { dark: "#111827", light: "#ffffff" },
  });

  return new NextResponse(qrBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
