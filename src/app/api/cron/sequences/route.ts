import { isCronAuthorized } from "@/lib/cron-auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { smsConfigured } from "@/lib/sms";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!smsConfigured) {
    return apiError("SMS is not configured; sequence steps were not sent", 503);
  }

  const now = new Date();
  const due = await prisma.commEnrollment.findMany({
    where: { status: "ACTIVE", nextStepAt: { lte: now } },
    include: {
      sequence: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
      customer: { select: { firstName: true, lastName: true, phone: true, smsOptOut: true, marketingOptOut: true, smsConsentAt: true } },
    },
    take: 50,
  });

  let sent = 0;
  let completed = 0;

  for (const enrollment of due) {
    const steps = enrollment.sequence.steps;
    const currentStep = steps.find(s => s.stepNumber === enrollment.currentStep + 1) || steps[enrollment.currentStep];

    if (!currentStep) {
      await prisma.commEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: now },
      });
      completed++;
      continue;
    }

    if (!enrollment.customer.phone || enrollment.customer.smsOptOut || enrollment.customer.marketingOptOut || !enrollment.customer.smsConsentAt) {
      // Keep the enrollment but stop retrying a customer we cannot reach or who opted out.
      await prisma.commEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "PAUSED" },
      });
      continue;
    }

    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const message = currentStep.messageTemplate
        .replace("{{firstName}}", enrollment.customer.firstName)
        .replace("{{lastName}}", enrollment.customer.lastName)
        .replace("{{name}}", `${enrollment.customer.firstName} ${enrollment.customer.lastName}`);
      const phone = enrollment.customer.phone.replace(/\D/g, "");
      await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phone.length === 10 ? `+1${phone}` : `+${phone}`,
        body: message,
      });

      await prisma.smsMessage.create({
        data: {
          customerId: enrollment.customerId,
          direction: "OUTBOUND",
          body: message,
          fromNumber: process.env.TWILIO_PHONE_NUMBER!,
          toNumber: enrollment.customer.phone,
        },
      });
      sent++;
    } catch (err) {
      // Leave the step due so a later run can retry. Never advance a sequence
      // past a message the customer did not receive.
      console.error("Sequence SMS error:", err);
      continue;
    }

    // Advance to next step
    const nextStepIndex = steps.findIndex(s => s.stepNumber === currentStep.stepNumber) + 1;
    const nextStep = steps[nextStepIndex];

    if (nextStep) {
      await prisma.commEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: currentStep.stepNumber,
          nextStepAt: new Date(now.getTime() + nextStep.delayHours * 3600000),
        },
      });
    } else {
      await prisma.commEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: now, currentStep: currentStep.stepNumber },
      });
      completed++;
    }
  }

  return apiSuccess({ processed: due.length, sent, completed });
}
