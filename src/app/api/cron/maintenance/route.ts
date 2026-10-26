import { isCronAuthorized } from "@/lib/cron-auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { smsConfigured } from "@/lib/sms";

// Weekly: find vehicles with maintenance intervals due soon (within 500 miles or 14 days)
const REMINDER_PENDING = " (reminder text pending)";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return apiError("Unauthorized", 401);

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 86400000);

  const due = await prisma.maintenanceInterval.findMany({
    where: {
      OR: [
        { nextDueDate: { lte: in14Days } },
        // mileage-based: we check if nextDueMiles is within current mileage + 500
        // We can't do this purely in DB without vehicle mileage comparison, so handle date-based here
      ],
    },
    include: {
      vehicle: {
        include: {
          customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, smsOptOut: true, marketingOptOut: true, smsConsentAt: true } },
        },
      },
    },
  });

  let notified = 0;

  for (const interval of due) {
    const { customer } = interval.vehicle;
    const dueDateStr = interval.nextDueDate?.toLocaleDateString() || "soon";
    const vehicleStr = `${interval.vehicle.year} ${interval.vehicle.make} ${interval.vehicle.model}`;

    // Create a follow-up if one doesn't already exist
    const existing = await prisma.followUp.findFirst({
      where: {
        customerId: customer.id,
        title: { contains: interval.serviceName },
        isCompleted: false,
      },
    });

    // Every new follow-up starts with the pending marker; the text is sent once
    // the customer can be texted (consent, no opt-out, SMS set up). Follow-ups
    // without the marker were already texted or predate it.
    let followUp = existing;
    if (!followUp) {
      followUp = await prisma.followUp.create({
        data: {
          customerId: customer.id,
          title: `${interval.serviceName} due — ${vehicleStr}`,
          notes: `Maintenance interval reminder. Due: ${dueDateStr}${REMINDER_PENDING}`,
          dueAt: interval.nextDueDate || in14Days,
        },
      });
    }
    if (!followUp.notes?.includes(REMINDER_PENDING)) continue;

    if (!customer.phone || !smsConfigured || customer.smsOptOut || customer.marketingOptOut || !customer.smsConsentAt) continue;

    // Claim the reminder in SQL so concurrent runs or staff note edits are never
    // overwritten, and a claimed reminder is not texted twice.
    const claimed = await prisma.$executeRaw`UPDATE "FollowUp" SET "notes" = replace("notes", ${REMINDER_PENDING}, '') WHERE "id" = ${followUp.id} AND "notes" LIKE ${"%" + REMINDER_PENDING + "%"}`;
    if (claimed !== 1) continue;

    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      await client.messages.create({
        body: `Hi ${customer.firstName}! Your ${vehicleStr} is due for ${interval.serviceName} around ${dueDateStr}. Call or text to schedule: ${process.env.TWILIO_PHONE_NUMBER}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: customer.phone,
      });
      notified++;
    } catch (e) {
      console.error("Maintenance SMS error:", e);
      // Not sent: put the marker back so a later run retries.
      await prisma.$executeRaw`UPDATE "FollowUp" SET "notes" = coalesce("notes", '') || ${REMINDER_PENDING} WHERE "id" = ${followUp.id}`.catch(() => {});
    }
  }

  return apiSuccess({ checked: due.length, notified });
}
