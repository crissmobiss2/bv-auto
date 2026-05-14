import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const q = req.nextUrl.searchParams.get("q") || "";
  if (!q || q.length < 2) return apiSuccess({ results: [] });

  const [customers, vehicles, jobs, invoices] = await Promise.all([
    prisma.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      take: 5,
    }),
    prisma.vehicle.findMany({
      where: {
        isActive: true,
        OR: [
          { vin: { contains: q, mode: "insensitive" } },
          { plate: { contains: q, mode: "insensitive" } },
          { make: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { customer: { select: { firstName: true, lastName: true } } },
      take: 5,
    }),
    prisma.job.findMany({
      where: {
        OR: [
          { jobNumber: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { customer: { select: { firstName: true, lastName: true } } },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { invoiceNumber: { contains: q, mode: "insensitive" } },
      include: { customer: { select: { firstName: true, lastName: true } } },
      take: 5,
    }),
  ]);

  const results = [
    ...customers.map((c) => ({
      type: "customer",
      id: c.id,
      label: `${c.firstName} ${c.lastName}`,
      sub: c.phone || c.email || "",
      href: `/customers/${c.id}`,
    })),
    ...vehicles.map((v) => ({
      type: "vehicle",
      id: v.id,
      label: `${v.year} ${v.make} ${v.model}`,
      sub: v.vin || v.plate || `${v.customer.firstName} ${v.customer.lastName}`,
      href: `/vehicles/${v.id}`,
    })),
    ...jobs.map((j) => ({
      type: "job",
      id: j.id,
      label: `${j.jobNumber} — ${j.title}`,
      sub: `${j.customer.firstName} ${j.customer.lastName}`,
      href: `/jobs/${j.id}`,
    })),
    ...invoices.map((i) => ({
      type: "invoice",
      id: i.id,
      label: i.invoiceNumber,
      sub: `${i.customer.firstName} ${i.customer.lastName}`,
      href: `/invoices/${i.id}`,
    })),
  ];

  return apiSuccess({ results });
}
