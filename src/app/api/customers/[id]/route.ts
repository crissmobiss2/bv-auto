import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit, pick } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";

const CUSTOMER_FIELDS = [
  "type", "firstName", "lastName", "company", "email", "phone", "altPhone",
  "address", "city", "state", "zip", "leadSource", "referredBy", "taxExempt",
  "taxExemptId", "notes", "tags", "isActive",
] as const;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, shopId },
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
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.customer.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Customer not found", 404);

  // Allowlist only — never let a client set portalToken / shopId / id.
  const updated = await prisma.customer.update({
    where: { id },
    data: pick(body, CUSTOMER_FIELDS),
  });

  await logAudit(session!.user.id, AuditAction.UPDATE, "Customer", id, existing, updated);

  return apiSuccess(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.customer.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Customer not found", 404);

  await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit(session!.user.id, AuditAction.DELETE, "Customer", id);

  return apiSuccess({ success: true });
}
