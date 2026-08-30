import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { z } from "zod";
import { AuditAction, CustomerType, LeadSource, Prisma } from "@prisma/client";

const createSchema = z.object({
  type: z.nativeEnum(CustomerType).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(7),
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
});

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = { isActive: true, shopId };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        vehicles: { where: { isActive: true }, select: { id: true, year: true, make: true, model: true } },
        _count: { select: { jobs: true, invoices: true } },
        invoices: { where: { status: "PAID" }, select: { totalAmount: true, paidAt: true } },
        jobs: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  const now = Date.now();
  const enriched = customers.map((c) => {
    const totalRevenue = c.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const visitCount = c._count.jobs;
    const avgTicket = visitCount > 0 ? totalRevenue / visitCount : 0;
    const lastVisit = c.jobs[0]?.createdAt;
    const daysSinceVisit = lastVisit ? Math.floor((now - new Date(lastVisit).getTime()) / 86400000) : 999;
    const atRisk = daysSinceVisit > 90 && visitCount > 1;
    // Simple CLV score 0-100
    const clvScore = Math.min(100, Math.round(
      (Math.min(totalRevenue, 10000) / 100) * 0.5 +
      (Math.min(visitCount, 20) / 20) * 30 +
      (daysSinceVisit < 90 ? 20 : daysSinceVisit < 180 ? 10 : 0)
    ));
    return {
      ...c,
      invoices: undefined,
      jobs: undefined,
      clv: { totalRevenue, visitCount, avgTicket, daysSinceVisit, atRisk, clvScore },
    };
  });

  return apiSuccess({ customers: enriched, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message);
  }

  const customer = await prisma.customer.create({
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
      tags: parsed.data.tags || [],
      shopId,
    },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "Customer", customer.id, null, customer);

  return apiSuccess(customer, 201);
}
