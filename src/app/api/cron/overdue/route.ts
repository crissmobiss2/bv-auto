import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
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
  for (const invoice of overdueInvoices) {
    if (!invoice.customer.email || !invoice.dueDate) continue;

    const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86400000);
    if (![1, 7, 14].includes(daysOverdue)) continue;

    const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
    await sendInvoiceEmail({
      to: invoice.customer.email,
      customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
      invoiceNumber: invoice.invoiceNumber,
      vehicleDescription: `${invoice.job.vehicle.year} ${invoice.job.vehicle.make} ${invoice.job.vehicle.model}`,
      totalAmount: formatCurrency(Number(invoice.totalAmount)),
      amountDue: formatCurrency(Number(invoice.amountDue)),
      invoiceUrl: `${BASE_URL}/invoices/${invoice.id}`,
      paymentUrl: invoice.stripePaymentUrl || undefined,
    }).catch(console.error);

    remindersSent++;
  }

  return NextResponse.json({
    markedOverdue: overdueResult.count,
    remindersSent,
    timestamp: now.toISOString(),
  });
}
