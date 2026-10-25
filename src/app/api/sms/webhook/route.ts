import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

// Twilio sends form-encoded POST to this webhook for inbound SMS
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const body = formData.get("Body") as string;
  const from = formData.get("From") as string;
  const to = formData.get("To") as string;
  const sid = formData.get("MessageSid") as string;

  // Verify the request actually came from Twilio. Without this, anyone can
  // spoof inbound messages, pollute customer threads, or forge STOP replies.
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return new NextResponse("SMS webhook is not configured", { status: 503 });
  }
  const signature = req.headers.get("x-twilio-signature");
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] || "https";
  const host = req.headers.get("x-forwarded-host")?.split(",")[0] || req.headers.get("host");
  const baseUrl = process.env.NEXTAUTH_URL || (host ? `${proto}://${host}` : "");
  const params = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
  if (!signature || !baseUrl || !twilio.validateRequest(authToken, signature, `${baseUrl.replace(/\/$/, "")}/api/sms/webhook`, params)) {
    return new NextResponse("Invalid Twilio signature", { status: 403 });
  }

  if (!from || !body) {
    return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
  }

  // Twilio retries webhooks; do not store the same message twice.
  if (sid) {
    const duplicate = await prisma.smsMessage.findFirst({
      where: { twilioSid: sid },
      select: { id: true },
    });
    if (duplicate) {
      return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }
  }

  // Normalize phone: strip everything except digits, keep leading +
  const normalized = from.replace(/[^\d+]/g, "");

  // Find customer by phone number (try multiple formats)
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone: from },
        { phone: normalized },
        { phone: normalized.replace(/^\+1/, "") },
        { altPhone: from },
        { altPhone: normalized },
      ],
    },
    select: { id: true },
  });

  if (customer) {
    await prisma.smsMessage.create({
      data: {
        customerId: customer.id,
        direction: "INBOUND",
        body,
        fromNumber: from,
        toNumber: to,
        twilioSid: sid,
      },
    });
  }

  return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
