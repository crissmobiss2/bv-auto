import { isCronAuthorized } from "@/lib/cron-auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { emailConfigured, escapeHtml } from "@/lib/email";
import { smsConfigured } from "@/lib/sms";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return apiError("Unauthorized", 401);

  if (!emailConfigured && !smsConfigured) {
    return apiError("Neither email nor SMS is configured; review requests were not sent", 503);
  }

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";

  // Find jobs completed in last 23-25 hours without a review request sent
  const cutoffStart = new Date(Date.now() - 25 * 3600000);
  const cutoffEnd = new Date(Date.now() - 23 * 3600000);

  const jobs = await prisma.job.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: cutoffStart, lte: cutoffEnd },
      reviewRequest: null,
    },
    include: {
      customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
    },
  });

  let sent = 0;

  for (const job of jobs) {
    const request = await prisma.reviewRequest.create({
      data: {
        jobId: job.id,
        customerId: job.customerId,
      },
    });

    const reviewUrl = `${BASE_URL}/api/review/${request.reviewToken}`;
    let delivered = false;

    // Send email
    if (job.customer.email && emailConfigured) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const result = await resend.emails.send({
          from: "B&V Mobile Auto <noreply@bvmobileauto.com>",
          to: job.customer.email,
          subject: "How did we do? Leave us a review",
          html: `<p>Hi ${escapeHtml(job.customer.firstName)},</p>
<p>Thank you for choosing B&V Mobile Auto! We hope your service went smoothly.</p>
<p>If you have a moment, we'd love a review — it helps other customers find us:</p>
<p><a href="${reviewUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Leave a Google Review</a></p>
<p>Thank you,<br/>The B&V Mobile Auto Team</p>`,
        });
        delivered = !result.error;
      } catch (e) {
        console.error("Review email error:", e);
      }
    }

    // Send SMS
    if (job.customer.phone && smsConfigured) {
      try {
        const twilio = (await import("twilio")).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.messages.create({
          body: `Hi ${job.customer.firstName}! Thanks for choosing B&V Mobile Auto. Mind leaving us a quick Google review? ${reviewUrl}`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: job.customer.phone,
        });
        delivered = true;
      } catch (e) {
        console.error("Review SMS error:", e);
      }
    }

    if (!delivered) {
      // Do not mark unsent requests as sent; remove the placeholder so a later
      // cron run can retry this job.
      await prisma.reviewRequest.delete({ where: { id: request.id } }).catch(() => {});
      continue;
    }

    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: { sentAt: new Date() },
    });

    sent++;
  }

  return apiSuccess({ processed: jobs.length, sent });
}
