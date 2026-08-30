import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

// Twilio sends form-encoded POST to this webhook for inbound SMS
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  // SECURITY: verify the request really came from Twilio before trusting any of
  // its fields — otherwise anyone can forge inbound texts against any customer.
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers.get("x-twilio-signature");
  const params: Record<string, string> = {};
  formData.forEach((value, key) => { params[key] = String(value); });
  const webhookUrl = `${process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app"}/api/sms/webhook`;

  if (!authToken || !signature || !twilio.validateRequest(authToken, signature, webhookUrl, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = formData.get("Body") as string;
  const from = formData.get("From") as string;
  const to = formData.get("To") as string;
  const sid = formData.get("MessageSid") as string;

  if (!from || !body) {
    return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
  }

  // Idempotency: Twilio may retry delivery of the same message.
  if (sid) {
    const seen = await prisma.smsMessage.findFirst({ where: { twilioSid: sid }, select: { id: true } });
    if (seen) return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
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
