import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction, JobStatus } from "@prisma/client";
import twilio from "twilio";

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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
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
  return apiSuccess(job);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) return apiError("Job not found", 404);

  // Handle status transitions
  const updateData: Record<string, unknown> = { ...body };
  if (body.status && body.status !== existing.status) {
    if (body.status === JobStatus.IN_PROGRESS && !existing.startedAt) {
      updateData.startedAt = new Date();
    }
    if (body.status === JobStatus.COMPLETED && !existing.completedAt) {
      updateData.completedAt = new Date();
    }
  }

  if (body.scheduledAt) {
    updateData.scheduledAt = new Date(body.scheduledAt);
  }

  const updated = await prisma.job.update({ where: { id }, data: updateData });

  if (body.status && body.status !== existing.status) {
    await logAudit(
      session!.user.id,
      AuditAction.STATUS_CHANGE,
      "Job",
      id,
      { status: existing.status },
      { status: updated.status }
    );
    // Auto-send SMS on key status transitions
    sendStatusSms(id, updated.status as JobStatus);
  } else {
    await logAudit(session!.user.id, AuditAction.UPDATE, "Job", id, existing, updated);
  }

  return apiSuccess(updated);
}
