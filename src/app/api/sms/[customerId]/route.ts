import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { customerId } = await params;
  const customer = await prisma.customer.findFirst({ where: { id: customerId, shopId } });
  if (!customer) return apiError("Customer not found", 404);

  const messages = await prisma.smsMessage.findMany({
    where: { customerId },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  // 5 SMS per minute per IP to prevent runaway Twilio charges
  if (!rateLimit(`sms:${getIP(req)}`, 5, 60_000)) {
    return apiError("Too many SMS requests. Please wait a minute.", 429);
  }

  const { customerId } = await params;
  const { body: messageBody } = await req.json();

  if (!messageBody?.trim()) return apiError("Message body required", 400);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, shopId },
    select: { phone: true },
  });
  if (!customer) return apiError("Customer not found", 404);

  const FROM = process.env.TWILIO_PHONE_NUMBER || "";
  let twilioSid: string | null = null;

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && FROM) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const msg = await client.messages.create({
        body: messageBody,
        from: FROM,
        to: customer.phone,
      });
      twilioSid = msg.sid;
    } catch (e) {
      console.error("Twilio send error:", e);
    }
  }

  const message = await prisma.smsMessage.create({
    data: {
      customerId,
      direction: "OUTBOUND",
      body: messageBody,
      fromNumber: FROM || "system",
      toNumber: customer.phone,
      twilioSid,
    },
  });

  return apiSuccess(message, 201);
}
