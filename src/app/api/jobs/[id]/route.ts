import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, JobStatus, WarrantyType } from "@prisma/client";
import { z } from "zod";
import twilio from "twilio";
import { sendPushToUser, sendPushToRole } from "@/lib/push";
import { transitionError } from "@/lib/job-status";
import { assertSmsAllowed } from "@/lib/consent";
import { takeSmsQuota } from "@/lib/plan-limits";

const updateJobSchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  technicianId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  serviceLocation: z.string().optional(),
  scheduledAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid scheduledAt").nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  actualHours: z.number().nonnegative().nullable().optional(),
  mileageIn: z.number().int().nonnegative().nullable().optional(),
  mileageOut: z.number().int().nonnegative().nullable().optional(),
  internalNotes: z.string().optional(),
  customerNotes: z.string().optional(),
  checklist: z.unknown().optional(),
  requiresReturn: z.boolean().optional(),
  vehicleHealthScore: z.number().int().min(0).max(100).nullable().optional(),
  fleetAccountId: z.string().nullable().optional(),
  fleetPoNumber: z.string().optional(),
}).partial();

const STATUS_SMS: Partial<Record<JobStatus, string>> = {
  IN_PROGRESS: "Hi {name}, your {vehicle} has been checked in and work has started. We'll keep you updated!",
  COMPLETED: "Hi {name}, great news — your {vehicle} is ready for pickup! Call us at {phone} or reply with any questions.",
  PARTS_WAITING: "Hi {name}, we're waiting on parts for your {vehicle}. We'll contact you as soon as they arrive.",
};

async function sendStatusSms(jobId: string, status: JobStatus) {
  const template = STATUS_SMS[status];
  if (!template) return;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) return;

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: { select: { id: true, firstName: true, phone: true } },
        vehicle: { select: { year: true, make: true, model: true } },
      },
    });
    if (!job?.customer?.phone) return;
    // A customer who replied STOP gets no status texts.
    await assertSmsAllowed(job.customer.phone);
    if (!(await takeSmsQuota())) return;

    const vehicleStr = `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`;
    const shopPhone = process.env.TWILIO_PHONE_NUMBER!;
    const body = template
      .replace("{name}", job.customer.firstName)
      .replace("{vehicle}", vehicleStr)
      .replace("{phone}", shopPhone);

    const tc = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await tc.messages.create({ body, from: shopPhone, to: job.customer.phone });
    await prisma.smsMessage.create({
      data: {
        customerId: job.customer.id,
        direction: "OUTBOUND",
        body,
        fromNumber: shopPhone,
        toNumber: job.customer.phone,
      },
    });
  } catch { /* non-fatal */ }
}

async function sendJobStatusPush(jobId: string, oldStatus: JobStatus, newStatus: JobStatus, _techId: string | null) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { title: true, technicianId: true },
    });
    if (!job) return;

    if (newStatus === JobStatus.COMPLETED) {
      // Notify dispatcher/admin that job is done
      sendPushToRole("ADMIN", { title: "Job Completed", body: `${job.title} has been marked complete.`, url: `/jobs/${jobId}`, tag: `job-${jobId}` });
    }
    if (newStatus === JobStatus.PARTS_WAITING) {
      sendPushToRole("ADMIN", { title: "Parts Needed", body: `${job.title} is waiting on parts.`, url: `/jobs/${jobId}`, tag: `job-${jobId}` });
    }
    // Notify assigned tech when job is approved/scheduled
    if ((newStatus === JobStatus.APPROVED || newStatus === JobStatus.SCHEDULED) && job.technicianId) {
      sendPushToUser(job.technicianId, { title: "Job Assigned", body: `You've been assigned: ${job.title}`, url: `/tech/jobs/${jobId}`, tag: `job-${jobId}` });
    }
  } catch { /* non-fatal */ }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      technician: { select: { id: true, name: true, phone: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      quote: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
      invoice: {
        include: {
          lineItems: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { receivedAt: "desc" } },
        },
      },
      parts: { include: { vendor: true }, orderBy: { createdAt: "asc" } },
      photos: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { takenAt: "desc" } },
      jobNotes: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      signatures: { orderBy: { signedAt: "desc" } },
      carfaxRecords: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technician?.id !== session!.user.id) {
    return apiError("You can only view jobs assigned to you", 403);
  }

  // Technicians need the work order, not the customer's bill or parts margin.
  if (session!.user.role === "TECHNICIAN") {
    const { quote: _quote, invoice: _invoice, parts, ...workOrder } = job;
    const safeParts = parts.map(({
      unitCost: _unitCost,
      unitPrice: _unitPrice,
      markup: _markup,
      totalCost: _totalCost,
      totalPrice: _totalPrice,
      coreCharge: _coreCharge,
      creditAmount: _creditAmount,
      vendor: _vendor,
      ...part
    }) => part);
    return apiSuccess({ ...workOrder, parts: safeParts });
  }

  return apiSuccess(job);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) return apiError("Job not found", 404);

  if (session!.user.role === "TECHNICIAN") {
    if (existing.technicianId !== session!.user.id) {
      return apiError("You can only update jobs assigned to you", 403);
    }
    if (parsed.data.technicianId !== undefined) {
      return apiError("Only dispatch or admin can reassign a job", 403);
    }
  }

  const input = parsed.data;

  // Reassignment must target an active technician. Otherwise a typo or crafted
  // request can assign work to a customer, an inactive tech, or an admin-only
  // account that never sees the technician board.
  if (input.technicianId) {
    const technician = await prisma.user.findUnique({
      where: { id: input.technicianId },
      select: { id: true, role: true, isActive: true },
    });
    if (!technician || !technician.isActive || !["TECHNICIAN", "ADMIN"].includes(technician.role)) {
      return apiError("Selected technician is not an active technician", 400);
    }
  }

  if (input.status && input.status !== existing.status) {
    const reason = transitionError(existing.status, input.status, session!.user.role);
    if (reason) return apiError(reason, 409);
    if (input.status === JobStatus.PAID) {
      const invoice = await prisma.invoice.findUnique({ where: { jobId: id }, select: { status: true } });
      if (invoice?.status !== "PAID") return apiError("Record the payment on the invoice; the job is marked paid when the invoice is paid", 409);
    }
  }

  const updateData: Record<string, unknown> = { ...input };
  if (input.scheduledAt !== undefined) {
    updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  }
  if (input.status && input.status !== existing.status) {
    if (input.status === JobStatus.IN_PROGRESS && !existing.startedAt) {
      updateData.startedAt = new Date();
    }
    if (input.status === JobStatus.COMPLETED && !existing.completedAt) {
      updateData.completedAt = new Date();
    }
  }

  const updated = await prisma.job.update({ where: { id }, data: updateData });

  // Cancelling stops any running clocks so the time can't keep accruing to payroll.
  if (input.status === JobStatus.CANCELLED && existing.status !== JobStatus.CANCELLED) {
    await prisma.timeLog.updateMany({ where: { jobId: id, clockedOut: null }, data: { clockedOut: new Date() } });
  }

  if (input.status && input.status !== existing.status) {
    await logAudit(
      session!.user.id,
      AuditAction.STATUS_CHANGE,
      "Job",
      id,
      { status: existing.status },
      { status: updated.status }
    );
    if (updated.status === JobStatus.COMPLETED && !existing.completedAt) {
      await createDefaultWarranty(updated).catch((e) => console.error("[warranty] auto-create failed", e));
    }
    // Auto-send SMS on key status transitions
    sendStatusSms(id, updated.status as JobStatus);
    // Push notifications for key transitions
    sendJobStatusPush(id, existing.status as JobStatus, updated.status as JobStatus, existing.technicianId).catch(() => {});
  } else {
    await logAudit(session!.user.id, AuditAction.UPDATE, "Job", id, existing, updated);
  }

  // Push when technician is newly assigned
  if (input.technicianId && input.technicianId !== existing.technicianId) {
    const jobTitle = (await prisma.job.findUnique({ where: { id }, select: { title: true } }))?.title ?? "a job";
    sendPushToUser(input.technicianId, { title: "Job Assigned to You", body: jobTitle, url: `/tech/jobs/${id}`, tag: `assign-${id}` }).catch(() => {});
  }

  return apiSuccess(updated);
}

// Default shop policy: 12 months / 12,000 miles parts & labor, created once per job.
const DEFAULT_WARRANTY_DAYS = 365;
const DEFAULT_WARRANTY_MILES = 12000;

async function createDefaultWarranty(job: { id: string; title: string; customerId: string; vehicleId: string; mileageIn: number | null }) {
  const exists = await prisma.warranty.findFirst({ where: { jobId: job.id }, select: { id: true } });
  if (exists) return;
  const startDate = new Date();
  await prisma.warranty.create({
    data: {
      jobId: job.id,
      customerId: job.customerId,
      vehicleId: job.vehicleId,
      type: WarrantyType.PARTS_AND_LABOR,
      description: `Parts & labor — ${job.title}`,
      startDate,
      expiryDate: new Date(startDate.getTime() + DEFAULT_WARRANTY_DAYS * 86400000),
      durationDays: DEFAULT_WARRANTY_DAYS,
      mileageAtService: job.mileageIn,
      mileageLimit: DEFAULT_WARRANTY_MILES,
    },
  });
}
