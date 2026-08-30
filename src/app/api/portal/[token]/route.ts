import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireStaff } from "@/lib/api-helpers";
import crypto from "crypto";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: {
      vehicles: {
        where: { isActive: true },
        orderBy: { year: "desc" },
        include: { maintenanceIntervals: { orderBy: { nextDueDate: "asc" }, take: 5 } },
      },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          vehicle: true,
          photos: { select: { id: true, url: true, caption: true, takenAt: true } },
          jobNotes: { where: { isInternal: false }, select: { content: true, createdAt: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { payments: true },
      },
      quotes: {
        where: { status: { in: ["SENT", "VIEWED"] } },
        orderBy: { createdAt: "desc" },
        include: { lineItems: true, job: { include: { vehicle: true } } },
      },
      smsMessages: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, direction: true, body: true, createdAt: true },
      },
    },
  });

  if (!customer) return apiError("Portal link not found", 404);

  // Strip internal fields
  const { notes: _n, ...safe } = customer as typeof customer & { notes?: string };
  void _n;
  return apiSuccess(safe);
}

// Generate or refresh a customer's portal token. Staff-only: this mints access
// credentials, so it must never be reachable anonymously.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { error } = await requireStaff();
  if (error) return error;

  // token segment here = customerId (used by staff to generate the link)
  const { token: customerId } = await params;

  const portalToken = crypto.randomBytes(20).toString("hex");
  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { portalToken },
    select: { id: true, firstName: true, lastName: true, portalToken: true },
  });

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
  return apiSuccess({ portalUrl: `${BASE_URL}/portal/${customer.portalToken}` });
}
