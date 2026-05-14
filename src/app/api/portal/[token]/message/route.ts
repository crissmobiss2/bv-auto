import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { body } = await req.json();

  if (!body?.trim()) return apiError("Message required");

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  if (!customer) return apiError("Portal not found", 404);

  const message = await prisma.smsMessage.create({
    data: {
      customerId: customer.id,
      direction: "INBOUND",
      body: `[Customer Portal] ${body}`,
      fromNumber: customer.phone || "portal",
      toNumber: process.env.TWILIO_PHONE_NUMBER || "shop",
    },
  });

  // Notify the shop via SMS if configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.SHOP_NOTIFY_PHONE) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Portal message from ${customer.firstName} ${customer.lastName}: ${body}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: process.env.SHOP_NOTIFY_PHONE,
      });
    } catch { /* non-fatal */ }
  }

  return apiSuccess(message, 201);
}
