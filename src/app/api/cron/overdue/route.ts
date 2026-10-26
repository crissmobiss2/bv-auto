import crypto from "crypto";
import { isCronAuthorized } from "@/lib/cron-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enterShop } from "@/lib/tenant";
import { sendInvoiceEmail, emailConfigured } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
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
    // Each reminder carries its own shop's name and reply-to address.
    if (invoice.shopId) enterShop(invoice.shopId);

    const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86400000);
    if (![1, 7, 14].includes(daysOverdue)) continue;
    // Cron can be retried or run twice in a day; one reminder per invoice per day.
    if (invoice.lastReminderAt && now.getTime() - invoice.lastReminderAt.getTime() < 20 * 3600_000) continue;

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
        // Stored checkout links expire after 24h; the portal creates a fresh one.
        paymentUrl: undefined,
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { lastReminderAt: now, reminderCount: { increment: 1 } },
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
