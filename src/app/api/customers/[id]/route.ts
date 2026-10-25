import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, CustomerType, LeadSource } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  type: z.nativeEnum(CustomerType).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(7).optional(),
  altPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  leadSource: z.nativeEnum(LeadSource).optional(),
  referredBy: z.string().optional(),
  taxExempt: z.boolean().optional(),
  taxExemptId: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  marketingOptOut: z.boolean().optional(),
  // Staff may record an opt-out; only the customer's START reply re-enables SMS.
  smsOptOut: z.literal(true).optional(),
}).partial();

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: { where: { isActive: true } },
      jobs: {
        include: { vehicle: true, technician: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
      followUps: { where: { isCompleted: false }, orderBy: { dueAt: "asc" } },
      communications: { orderBy: { sentAt: "desc" }, take: 20 },
      customerNotes: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!customer) return apiError("Customer not found", 404);

  // Compute CLV from invoice/job data
  const paidInvoices = customer.invoices.filter(i => i.status === "PAID");
  const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const visitCount = customer.jobs.length;
  const avgTicket = visitCount > 0 ? totalRevenue / visitCount : 0;
  const lastJob = customer.jobs[0];
  const now = Date.now();
  const daysSinceVisit = lastJob ? Math.floor((now - new Date(lastJob.createdAt).getTime()) / 86400000) : 999;
  const atRisk = daysSinceVisit > 90 && visitCount > 1;
  const clvScore = Math.min(100, Math.round(
    (Math.min(totalRevenue, 10000) / 100) * 0.5 +
    (Math.min(visitCount, 20) / 20) * 30 +
    (daysSinceVisit < 90 ? 20 : daysSinceVisit < 180 ? 10 : 0)
  ));

  return apiSuccess({ ...customer, clv: { totalRevenue, visitCount, avgTicket, daysSinceVisit, atRisk, clvScore } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return apiError("Customer not found", 404);

  const { email, ...rest } = parsed.data;
  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...rest,
      ...(email !== undefined && { email: email || null }),
      ...(rest.smsOptOut && !existing.smsOptOut && { smsOptOutAt: new Date() }),
    },
  });

  await logAudit(session!.user.id, AuditAction.UPDATE, "Customer", id, existing, updated);

  return apiSuccess(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const _customer = await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit(session!.user.id, AuditAction.DELETE, "Customer", id);

  return apiSuccess({ success: true });
}
