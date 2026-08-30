import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";
import twilio from "twilio";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, shopId },
    select: { customerId: true, customer: { select: { phone: true, firstName: true, lastName: true } } },
  });
  if (!job) return apiError("Job not found", 404);
  if (!job.customerId) return apiSuccess({ messages: [] });

  const messages = await prisma.smsMessage.findMany({
    where: { customerId: job.customerId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return apiSuccess({ messages, customer: job.customer });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const { body } = await req.json();

  if (!body?.trim()) return apiError("Message body required");

  const job = await prisma.job.findFirst({
    where: { id, shopId },
    select: { customerId: true, customer: { select: { phone: true, firstName: true, lastName: true } } },
  });
  if (!job) return apiError("Job not found", 404);
  if (!job.customer?.phone) return apiError("Customer has no phone number on file");

  const shopPhone = process.env.TWILIO_PHONE_NUMBER!;
  const toPhone = job.customer.phone.replace(/\D/g, "");
  const e164 = toPhone.length === 10 ? `+1${toPhone}` : `+${toPhone}`;

  let twilioSid: string | undefined;

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const tc = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const msg = await tc.messages.create({ body: body.trim(), from: shopPhone, to: e164 });
      twilioSid = msg.sid;
    } catch (err) {
      return apiError(`SMS send failed: ${(err as Error).message}`);
    }
  }

  const message = await prisma.smsMessage.create({
    data: {
      customerId: job.customerId!,
      direction: "OUTBOUND",
      body: body.trim(),
      fromNumber: shopPhone || "shop",
      toNumber: e164,
      twilioSid,
    },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "SmsMessage", message.id, null, { jobId: id, to: e164 });

  return apiSuccess({ message });
}
