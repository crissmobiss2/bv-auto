import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { smsConfigured } from "@/lib/sms";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";

  const job = await prisma.job.findUnique({
    where: { id },
    include: { customer: { select: { id: true, phone: true, email: true, firstName: true, lastName: true } } },
  });
  if (!job) return apiError("Job not found", 404);

  let request = await prisma.reviewRequest.findUnique({ where: { jobId: id } });
  if (!request) {
    request = await prisma.reviewRequest.create({ data: { jobId: id, customerId: job.customerId } });
  }

  const reviewUrl = `${BASE_URL}/api/review/${request.reviewToken}`;

  const defaultReviewUrl = process.env.GOOGLE_REVIEW_URL || reviewUrl;

  if (!job.customer.phone) {
    return apiError("Customer has no phone number on file", 400);
  }
  if (!smsConfigured) {
    return apiError("SMS is not configured (missing Twilio credentials or phone number)", 503);
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    const body = `Hi ${job.customer.firstName}, thank you for choosing B&V Auto! If you had a great experience, a quick Google review means the world to us: ${defaultReviewUrl}`;
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: job.customer.phone,
    });
    await prisma.smsMessage.create({
      data: {
        customerId: job.customer.id,
        direction: "OUTBOUND",
        body,
        fromNumber: process.env.TWILIO_PHONE_NUMBER!,
        toNumber: job.customer.phone,
      },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Review SMS failed to send", 502);
  }

  await prisma.reviewRequest.update({
    where: { id: request.id },
    data: { sentAt: new Date() },
  });

  return apiSuccess({ sent: true, smsSent: true, reviewUrl });
}
