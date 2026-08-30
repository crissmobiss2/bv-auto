import { requireShop, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const in14Days = new Date(now.getTime() + 14 * 86400000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    overdueInvoices,
    pendingApprovalJobs,
    requestedParts,
    unassignedJobs,
    jobsScheduledToday,
    warrantiesExpiring,
    maintenanceDue,
    lowInventory,
  ] = await Promise.all([
    // Overdue invoices
    prisma.invoice.findMany({
      where: { shopId, status: "OVERDUE" },
      select: {
        id: true, invoiceNumber: true, amountDue: true, dueDate: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),

    // Jobs with quotes awaiting customer approval
    prisma.job.findMany({
      where: { shopId, status: "PENDING_APPROVAL" },
      select: {
        id: true, jobNumber: true, title: true, createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      take: 20,
    }),

    // Parts that need to be ordered
    prisma.jobPart.findMany({
      where: { job: { shopId }, status: "REQUESTED" },
      select: {
        id: true, description: true, partNumber: true, requestedAt: true,
        job: { select: { id: true, jobNumber: true } },
      },
      orderBy: { requestedAt: "asc" },
      take: 20,
    }),

    // Jobs without a technician assigned that are scheduled
    prisma.job.findMany({
      where: { shopId, status: "SCHEDULED", technicianId: null, scheduledAt: { gte: todayStart } },
      select: {
        id: true, jobNumber: true, title: true, scheduledAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),

    // Jobs scheduled for today
    prisma.job.findMany({
      where: {
        shopId,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledAt: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
      },
      select: {
        id: true, jobNumber: true, title: true, scheduledAt: true, status: true,
        customer: { select: { firstName: true, lastName: true } },
        technician: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),

    // Warranties expiring in 14 days
    prisma.warranty.findMany({
      where: { job: { shopId }, status: "ACTIVE", expiryDate: { gte: now, lte: in14Days } },
      select: {
        id: true, description: true, expiryDate: true,
        job: { select: { id: true, jobNumber: true, customer: { select: { firstName: true, lastName: true } } } },
      },
      take: 10,
    }),

    // Maintenance due in 7 days
    prisma.maintenanceInterval.findMany({
      where: { vehicle: { shopId }, nextDueDate: { gte: now, lte: in7Days } },
      select: {
        id: true, serviceName: true, nextDueDate: true,
        vehicle: { select: { id: true, year: true, make: true, model: true, customer: { select: { firstName: true, lastName: true } } } },
      },
      take: 10,
    }),

    // Low inventory items (quantityOnHand <= reorderPoint, only items with a reorder point set)
    prisma.inventoryItem.findMany({
      where: { shopId, isActive: true, reorderPoint: { gt: 0 } },
      select: { id: true, name: true, partNumber: true, quantityOnHand: true, reorderPoint: true },
      take: 50,
    }).then(items => items.filter(i => i.quantityOnHand <= i.reorderPoint)).catch(() => []),
  ]);

  return apiSuccess({
    overdueInvoices,
    pendingApprovalJobs,
    requestedParts,
    unassignedJobs,
    jobsScheduledToday,
    warrantiesExpiring,
    maintenanceDue,
    lowInventory,
    counts: {
      overdue: overdueInvoices.length,
      pendingApproval: pendingApprovalJobs.length,
      partsToOrder: requestedParts.length,
      unassigned: unassignedJobs.length,
      todayJobs: jobsScheduledToday.length,
      warrantiesExpiring: warrantiesExpiring.length,
      maintenanceDue: maintenanceDue.length,
      lowInventory: lowInventory.length,
    },
  });
}
