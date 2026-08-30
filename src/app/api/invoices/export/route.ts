import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop } from "@/lib/api-helpers";
import { csvCell } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop(["ADMIN", "ACCOUNTANT"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const invoices = await prisma.invoice.findMany({
    where: {
      shopId,
      status: { not: "VOID" },
      ...(from && { createdAt: { gte: new Date(from) } }),
      ...(to && { createdAt: { lte: new Date(to) } }),
    },
    include: {
      customer: true,
      payments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: string[] = [
    "Invoice Number,Customer,Date,Due Date,Status,Subtotal,Tax,Discount,Total,Amount Paid,Amount Due,Payment Method",
  ];

  for (const inv of invoices) {
    const primaryPayment = inv.payments[0];
    rows.push([
      inv.invoiceNumber,
      `${inv.customer.firstName} ${inv.customer.lastName}${inv.customer.company ? ` (${inv.customer.company})` : ""}`,
      new Date(inv.createdAt).toLocaleDateString(),
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "",
      inv.status,
      Number(inv.subtotal).toFixed(2),
      Number(inv.taxAmount).toFixed(2),
      Number(inv.discountAmount).toFixed(2),
      Number(inv.totalAmount).toFixed(2),
      Number(inv.amountPaid).toFixed(2),
      Number(inv.amountDue).toFixed(2),
      primaryPayment?.method.replace(/_/g, " ") || "",
    ].map(csvCell).join(","));
  }

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="invoices-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
