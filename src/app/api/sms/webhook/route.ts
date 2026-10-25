import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";
import { parseSmsKeyword, setSmsOptOut } from "@/lib/consent";
import { getShopPhone } from "@/lib/shop";

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
  const url = host ? `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}` : req.url;
  const params = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
  if (!signature || !twilio.validateRequest(authToken, signature, url, params)) {
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

  // Carrier opt-out keywords. Twilio's Advanced Opt-Out sends the STOP/START
  // reply itself; we only have to record consent so our own sends honour it.
  const keyword = parseSmsKeyword(body);
  if (keyword === "STOP" || keyword === "START") {
    await setSmsOptOut(from, keyword === "STOP");
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

  if (keyword === "HELP") {
    const phone = await getShopPhone();
    const help = `B&V Mobile Auto: ${phone ? `call ${phone} for help. ` : ""}Reply STOP to opt out, START to opt back in. Msg&data rates may apply.`;
    return new NextResponse(`<Response><Message>${help.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
