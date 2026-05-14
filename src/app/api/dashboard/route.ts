import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    openJobs,
    jobsToday,
    pendingInvoices,
    overdueInvoices,
    partsWaiting,
    revenueToday,
    revenueWeek,
    revenueMonth,
    recentJobs,
    topCustomers,
  ] = await Promise.all([
    prisma.job.count({
      where: {
        status: {
          in: ["ESTIMATE", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "IN_PROGRESS", "PARTS_WAITING"],
        },
      },
    }),
    prisma.job.count({
      where: {
        scheduledAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) },
      },
    }),
    prisma.invoice.count({
      where: { status: { in: ["SENT", "VIEWED", "PARTIAL"] } },
    }),
    prisma.invoice.count({
      where: { status: "OVERDUE" },
    }),
    prisma.jobPart.count({
      where: { status: { in: ["REQUESTED", "QUOTED", "ORDERED", "SHIPPED"] } },
    }),
    prisma.payment.aggregate({
      where: { receivedAt: { gte: startOfToday } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { receivedAt: { gte: startOfWeek } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { receivedAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.job.findMany({
      where: { status: { notIn: ["CANCELLED", "PAID"] } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        vehicle: { select: { year: true, make: true, model: true } },
        technician: { select: { name: true } },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { jobs: true, invoices: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return apiSuccess({
    stats: {
      openJobs,
      jobsToday,
      pendingInvoices,
      overdueInvoices,
      partsWaiting,
      revenue: {
        today: Number(revenueToday._sum.amount ?? 0),
        week: Number(revenueWeek._sum.amount ?? 0),
        month: Number(revenueMonth._sum.amount ?? 0),
      },
    },
    recentJobs,
    topCustomers,
  });
}
