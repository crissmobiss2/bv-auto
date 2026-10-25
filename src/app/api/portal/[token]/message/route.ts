import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { smsConfigured } from "@/lib/sms";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!rateLimit(`portal-message:${token}:${getIP(req)}`, 5, 10 * 60_000)) {
    return apiError("Too many messages. Please wait and try again.", 429);
  }

  const { body } = await req.json();
  if (!body?.trim()) return apiError("Message required");
  if (typeof body !== "string" || body.length > 2000) {
    return apiError("Message must be 2,000 characters or fewer", 400);
  }

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
  if (smsConfigured && process.env.SHOP_NOTIFY_PHONE) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      await client.messages.create({
        body: `Portal message from ${customer.firstName} ${customer.lastName}: ${body}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: process.env.SHOP_NOTIFY_PHONE,
      });
    } catch { /* non-fatal */ }
  }

  return apiSuccess(message, 201);
}
