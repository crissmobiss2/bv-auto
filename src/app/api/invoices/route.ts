import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { generateInvoiceNumber } from "@/lib/utils";
import { AuditAction } from "@prisma/client";

const INVOICE_ROLES = ["ADMIN", "DISPATCHER", "ACCOUNTANT", "SERVICE_ADVISOR"] as const;

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop(INVOICE_ROLES);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { shopId };
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        job: { include: { vehicle: { select: { year: true, make: true, model: true } } } },
        payments: { orderBy: { receivedAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return apiSuccess({ invoices, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session, shopId } = await requireShop(INVOICE_ROLES);
  if (error) return error;

  const body = await req.json();
  const { jobId } = body;

  if (!jobId) return apiError("jobId is required");

  // Get the job with its approved quote (scoped to this shop)
  const job = await prisma.job.findFirst({
    where: { id: jobId, shopId },
    include: {
      quote: { include: { lineItems: true } },
      customer: true,
    },
  });

  if (!job) return apiError("Job not found", 404);
  if (!job.quote) return apiError("No quote found for this job");

  // Check for existing invoice
  const existing = await prisma.invoice.findUnique({ where: { jobId } });
  if (existing) return apiError("Invoice already exists for this job");

  const quote = job.quote;

  // Create invoice from approved quote
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber(),
      jobId,
      customerId: job.customerId,
      createdById: session!.user.id,
      shopId,
      subtotal: quote.subtotal,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      discountAmount: quote.discountAmount,
      totalAmount: quote.totalAmount,
      amountDue: quote.totalAmount,
      notes: body.notes,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      lineItems: {
        create: quote.lineItems.map((li) => ({
          type: li.type,
          sortOrder: li.sortOrder,
          description: li.description,
          partNumber: li.partNumber,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          markup: li.markup,
          discount: li.discount,
          taxable: li.taxable,
          total: li.total,
          notes: li.notes,
        })),
      },
    },
    include: { lineItems: true, payments: true },
  });

  // Update job status
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "INVOICED" },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "Invoice", invoice.id, null, invoice);

  return apiSuccess(invoice, 201);
}
