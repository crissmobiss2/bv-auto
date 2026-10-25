import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail, emailConfigured } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Mark past-due invoices as OVERDUE
  const overdueResult = await prisma.invoice.updateMany({
    where: {
      status: { in: ["SENT", "VIEWED", "PARTIAL"] },
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  });

  // Send reminders for invoices overdue 1, 7, 14 days
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: "OVERDUE" },
    include: {
      customer: true,
      job: { include: { vehicle: true } },
    },
  });

  let remindersSent = 0;
  if (!emailConfigured) {
    return NextResponse.json({
      markedOverdue: overdueResult.count,
      remindersSent: 0,
      skipped: "Email is not configured (missing RESEND_API_KEY)",
      timestamp: now.toISOString(),
    });
  }

  for (const invoice of overdueInvoices) {
    if (!invoice.customer.email || !invoice.dueDate) continue;

    const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86400000);
    if (![1, 7, 14].includes(daysOverdue)) continue;

    const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
    // Customers cannot open staff dashboard pages. Create a portal token on
    // first reminder so every overdue email links somewhere the customer can
    // actually open.
    let portalToken = invoice.customer.portalToken;
    if (!portalToken) {
      portalToken = crypto.randomBytes(20).toString("hex");
      await prisma.customer.update({
        where: { id: invoice.customerId },
        data: { portalToken },
      });
    }
    const invoiceUrl = `${BASE_URL}/portal/${portalToken}`;
    try {
      await sendInvoiceEmail({
        to: invoice.customer.email,
        customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        invoiceNumber: invoice.invoiceNumber,
        vehicleDescription: `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model}`,
        totalAmount: formatCurrency(Number(invoice.totalAmount)),
        amountDue: formatCurrency(Number(invoice.amountDue)),
        invoiceUrl,
        paymentUrl: invoice.stripePaymentUrl || undefined,
      });
      remindersSent++;
    } catch (e) {
      console.error(`Overdue reminder failed for invoice ${invoice.invoiceNumber}:`, e);
    }
  }

  return NextResponse.json({
    markedOverdue: overdueResult.count,
    remindersSent,
    timestamp: now.toISOString(),
  });
}
