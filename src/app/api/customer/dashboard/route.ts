import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  if (session!.user.role !== "CUSTOMER") return apiError("Forbidden", 403);

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { customerId: true, name: true, email: true, phone: true },
  });

  if (!user?.customerId) {
    return apiSuccess({ customer: null, vehicles: [], jobs: [], invoices: [], stats: {} });
  }

  const customerId = user.customerId;

  const [customer, vehicles, recentJobs, openInvoices] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, city: true, state: true },
    }),

    prisma.vehicle.findMany({
      where: { customerId, isActive: true },
      select: {
        id: true, year: true, make: true, model: true, trim: true,
        vin: true, plate: true, mileage: true, color: true,
        maintenanceIntervals: {
          where: { nextDueDate: { lte: new Date(Date.now() + 30 * 86400000) } },
          select: { serviceName: true, nextDueDate: true },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    prisma.job.findMany({
      where: { customerId, status: { in: ["COMPLETED", "IN_PROGRESS", "SCHEDULED"] } },
      select: {
        id: true, jobNumber: true, title: true, status: true,
        scheduledAt: true, completedAt: true, createdAt: true,
        vehicle: { select: { year: true, make: true, model: true } },
        technician: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    prisma.invoice.findMany({
      where: { customerId, status: { in: ["SENT", "OVERDUE", "PARTIAL"] } },
      select: {
        id: true, invoiceNumber: true, status: true,
        totalAmount: true, amountDue: true, dueDate: true,
        job: { select: { title: true, jobNumber: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const totalSpend = await prisma.invoice.aggregate({
    where: { customerId, status: { in: ["PAID", "PARTIAL"] } },
    _sum: { totalAmount: true },
  });

  return apiSuccess({
    customer,
    vehicles,
    recentJobs,
    openInvoices,
    stats: {
      totalVehicles: vehicles.length,
      totalJobs: recentJobs.length,
      totalSpend: Number(totalSpend._sum.totalAmount || 0),
      openBalance: openInvoices.reduce((s, i) => s + Number(i.amountDue), 0),
    },
  });
}
