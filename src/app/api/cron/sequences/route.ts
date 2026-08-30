import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, assertCron } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const unauthorized = assertCron(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const due = await prisma.commEnrollment.findMany({
    where: { status: "ACTIVE", nextStepAt: { lte: now } },
    include: {
      sequence: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
      customer: { select: { firstName: true, lastName: true, phone: true } },
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

    // Send SMS if Twilio is configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && enrollment.customer.phone) {
      try {
        const twilio = (await import("twilio")).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const message = currentStep.messageTemplate
          .replace("{{firstName}}", enrollment.customer.firstName)
          .replace("{{lastName}}", enrollment.customer.lastName)
          .replace("{{name}}", `${enrollment.customer.firstName} ${enrollment.customer.lastName}`);
        const phone = enrollment.customer.phone.replace(/\D/g, "");
        await client.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone.length === 10 ? `+1${phone}` : `+${phone}`,
          body: message,
        });

        // Log to smsMessage
        await prisma.smsMessage.create({
          data: {
            customerId: enrollment.customerId,
            direction: "OUTBOUND",
            body: message,
            fromNumber: process.env.TWILIO_PHONE_NUMBER,
            toNumber: enrollment.customer.phone,
          },
        });
        sent++;
      } catch (err) {
        console.error("Sequence SMS error:", err);
      }
    } else {
      console.log(`[SEQ STUB] To: ${enrollment.customer.firstName} ${enrollment.customer.lastName} | Step ${currentStep.stepNumber}: ${currentStep.messageTemplate.slice(0, 80)}`);
      sent++;
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
