import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// Weekly: find vehicles with maintenance intervals due soon (within 500 miles or 14 days)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) return apiError("Unauthorized", 401);

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
          customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
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

    if (!existing) {
      await prisma.followUp.create({
        data: {
          customerId: customer.id,
          title: `${interval.serviceName} due — ${vehicleStr}`,
          notes: `Maintenance interval reminder. Due: ${dueDateStr}`,
          dueAt: interval.nextDueDate || in14Days,
        },
      });
    }

    // Send SMS reminder
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const twilio = (await import("twilio")).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: `Hi ${customer.firstName}! Your ${vehicleStr} is due for ${interval.serviceName} around ${dueDateStr}. Call or text to schedule: ${process.env.TWILIO_PHONE_NUMBER}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customer.phone,
        });
        notified++;
      } catch (e) {
        console.error("Maintenance SMS error:", e);
      }
    }
  }

  return apiSuccess({ checked: due.length, notified });
}
