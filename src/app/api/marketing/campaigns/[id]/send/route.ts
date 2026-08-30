import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError } from "@/lib/api-helpers";
import twilio from "twilio";
import { NotificationType } from "@prisma/client";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Bulk SMS blast — managers only, and only ever targets this shop's customers.
  const { error, shopId } = await requireShop(["ADMIN", "DISPATCHER"]);
  if (error) return error;

  const { id } = await params;
  const campaign = await prisma.marketingCampaign.findFirst({ where: { id, shopId } });
  if (!campaign) return apiError("Campaign not found", 404);

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    return apiError("Twilio not configured", 503);
  }

  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  let customers: { id: string; firstName: string; lastName: string; phone: string }[] = [];
  const now = new Date();

  if (campaign.triggerType === "WIN_BACK") {
    const days = parseInt(campaign.triggerValue || "90");
    const cutoff = new Date(now.getTime() - days * 86400000);
    const rawCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        shopId,
        jobs: { none: { createdAt: { gte: cutoff } } },
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    customers = rawCustomers;
  } else if (campaign.triggerType === "SERVICE_REMINDER") {
    const rawCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        shopId,
        vehicles: {
          some: {
            maintenanceIntervals: {
              some: {
                nextDueDate: {
                  lte: new Date(now.getTime() + 14 * 86400000),
                  gte: now,
                },
              },
            },
          },
        },
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    customers = rawCustomers;
  } else if (campaign.triggerType === "ALL_ACTIVE") {
    const rawCustomers = await prisma.customer.findMany({
      where: { isActive: true, shopId },
      select: { id: true, firstName: true, lastName: true, phone: true },
      take: 500,
    });
    customers = rawCustomers;
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const customer of customers.slice(0, 100)) {
    const message = campaign.messageTemplate
      .replace(/\{firstName\}/g, customer.firstName)
      .replace(/\{lastName\}/g, customer.lastName)
      .replace(/\{name\}/g, `${customer.firstName} ${customer.lastName}`);

    try {
      const twilioMsg = await twilioClient.messages.create({ body: message, from: fromNumber, to: customer.phone });
      await prisma.smsMessage.create({
        data: {
          customerId: customer.id,
          direction: "OUTBOUND",
          body: message,
          fromNumber,
          toNumber: customer.phone,
          twilioSid: twilioMsg.sid,
        },
      });
      await prisma.communication.create({
        data: {
          customerId: customer.id,
          type: NotificationType.SMS,
          direction: "OUTBOUND",
          body: message,
          status: "sent",
          metadata: { campaignId: campaign.id, campaignName: campaign.name },
        },
      });
      sentCount++;
    } catch (e) {
      errors.push(`${customer.phone}: ${(e as Error).message}`);
    }
  }

  await prisma.marketingCampaign.update({
    where: { id },
    data: { sentCount: { increment: sentCount }, lastRunAt: now },
  });

  return apiSuccess({ sentCount, totalTargeted: customers.length, errors: errors.slice(0, 5) });
}
