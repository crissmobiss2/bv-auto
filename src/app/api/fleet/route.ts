import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const accounts = await prisma.fleetAccount.findMany({
    where: {
      shopId,
      isActive: true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: {
      _count: { select: { jobs: true } },
      jobs: {
        where: { invoice: { status: { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] } } },
        select: { invoice: { select: { amountDue: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = accounts.map((a) => ({
    ...a,
    jobCount: a._count.jobs,
    openBalance: a.jobs.reduce((s, j) => s + Number(j.invoice?.amountDue ?? 0), 0),
    jobs: undefined,
    _count: undefined,
  }));

  return apiSuccess(result);
}

export async function POST(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json();
  if (!body.name) return apiError("name is required");

  const account = await prisma.fleetAccount.create({
    data: {
      shopId,
      name: body.name,
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      billingTerms: body.billingTerms || "NET_30",
      customLaborRate: body.customLaborRate ? Number(body.customLaborRate) : null,
      poRequired: body.poRequired ?? false,
      creditLimit: body.creditLimit ? Number(body.creditLimit) : null,
      notes: body.notes,
    },
  });

  return apiSuccess(account, 201);
}
