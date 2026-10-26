import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { SMS_LIMIT_MESSAGE, takeSmsQuota } from "@/lib/plan-limits";

export async function GET(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { customerId } = await params;
  const messages = await prisma.smsMessage.findMany({
    where: { customerId },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  // 5 SMS per minute per IP to prevent runaway Twilio charges
  if (!(await rateLimit(`sms:${getIP(req)}`, 5, 60_000))) {
    return apiError("Too many SMS requests. Please wait a minute.", 429);
  }

  const { customerId } = await params;
  const { body: messageBody } = await req.json();

  if (!messageBody?.trim()) return apiError("Message body required", 400);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { phone: true, smsOptOut: true },
  });
  if (!customer) return apiError("Customer not found", 404);
  if (customer.smsOptOut) {
    return apiError("This customer replied STOP. They must text START before you can message them.", 409);
  }

  const FROM = process.env.TWILIO_PHONE_NUMBER || "";
  let twilioSid: string | null = null;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !FROM) {
    return apiError("SMS isn't configured (Twilio credentials missing). Message not sent.", 503);
  }
  if (!(await takeSmsQuota())) return apiError(SMS_LIMIT_MESSAGE, 429);
  {
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
      return apiError("Text failed to send. Check the phone number and try again.", 502);
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
