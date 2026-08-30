import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { generateQuoteNumber, calculateLineItemTotal, computeTotals } from "@/lib/utils";
import { z } from "zod";
import { AuditAction, LineItemType } from "@prisma/client";

const QUOTE_ROLES = ["ADMIN", "DISPATCHER", "ACCOUNTANT", "SERVICE_ADVISOR"] as const;

const lineItemSchema = z.object({
  type: z.nativeEnum(LineItemType).default("LABOR"),
  sortOrder: z.number().default(0),
  description: z.string().min(1),
  partNumber: z.string().optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
  markup: z.number().optional(),
  discount: z.number().optional(),
  taxable: z.boolean().default(true),
  notes: z.string().optional(),
});

const createSchema = z.object({
  jobId: z.string(),
  customerId: z.string(),
  title: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  validUntil: z.string().optional(),
  taxRate: z.number().min(0).max(30).default(0),
  depositRequired: z.number().optional(),
  lineItems: z.array(lineItemSchema).default([]),
});

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop(QUOTE_ROLES);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const jobId = searchParams.get("jobId");
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { shopId };
  if (jobId) where.jobId = jobId;
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        job: { include: { vehicle: { select: { year: true, make: true, model: true } } } },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.quote.count({ where }),
  ]);

  return apiSuccess({ quotes, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session, shopId } = await requireShop(QUOTE_ROLES);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  // Check job exists and belongs to this shop
  const job = await prisma.job.findFirst({ where: { id: parsed.data.jobId, shopId } });
  if (!job) return apiError("Job not found", 404);

  // Check no existing quote for this job
  const existing = await prisma.quote.findUnique({ where: { jobId: parsed.data.jobId } });
  if (existing) return apiError("Quote already exists for this job");

  // Calculate line totals, then quote totals (discount-aware) from the shared helper.
  const lineItemsWithTotals = parsed.data.lineItems.map((li) => ({
    ...li,
    total: calculateLineItemTotal(li.quantity, li.unitPrice, li.markup, li.discount),
  }));

  const { subtotal, discountAmount, taxAmount, totalAmount } = computeTotals(
    lineItemsWithTotals,
    parsed.data.taxRate
  );

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: generateQuoteNumber(),
      jobId: parsed.data.jobId,
      customerId: parsed.data.customerId,
      createdById: session!.user.id,
      shopId,
      title: parsed.data.title,
      notes: parsed.data.notes,
      internalNotes: parsed.data.internalNotes,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
      taxRate: parsed.data.taxRate,
      taxAmount,
      subtotal,
      discountAmount,
      totalAmount,
      depositRequired: parsed.data.depositRequired,
      lineItems: {
        create: lineItemsWithTotals.map((li) => ({
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
    include: { lineItems: true },
  });

  // Update job status to PENDING_APPROVAL
  await prisma.job.update({
    where: { id: parsed.data.jobId },
    data: { status: "PENDING_APPROVAL" },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "Quote", quote.id, null, quote);

  return apiSuccess(quote, 201);
}
