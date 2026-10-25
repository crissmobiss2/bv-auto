import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileInvoice } from "@/lib/payments";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { generateInvoiceNumber } from "@/lib/utils";
import { AuditAction, InvoiceStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25") || 25));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (customerId) where.customerId = customerId;
  if (status) {
    if (!Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
      return apiError(`Invalid invoice status: ${status}`, 400);
    }
    where.status = status;
  }

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
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { jobId } = body;

  if (!jobId) return apiError("jobId is required");

  // Get the job with its approved quote
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      quote: { include: { lineItems: true } },
      customer: true,
    },
  });

  if (!job) return apiError("Job not found", 404);
  if (!job.quote) return apiError("No quote found for this job");
  if (!["APPROVED", "CONVERTED"].includes(job.quote.status)) {
    return apiError("The quote must be approved before an invoice can be created", 400);
  }

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

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "INVOICED" },
  });

  // A deposit collected on the quote becomes the first payment on the invoice.
  // Runs after the job is INVOICED so a deposit covering the total can mark it PAID.
  const deposit = Number(quote.depositPaid ?? 0);
  if (deposit > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: deposit,
          type: "DEPOSIT",
          method: "CREDIT_CARD",
          reference: quote.depositExternalId,
          externalId: quote.depositExternalId ? `deposit:${quote.depositExternalId}` : null,
          notes: "Deposit collected on quote",
          receivedAt: quote.depositPaidAt ?? new Date(),
        },
      });
      await reconcileInvoice(tx, invoice.id);
    });
  }

  const created = deposit > 0
    ? await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { lineItems: true, payments: true } })
    : invoice;

  await logAudit(session!.user.id, AuditAction.CREATE, "Invoice", invoice.id, null, created);

  return apiSuccess(created, 201);
}
