import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Twilio sends form-encoded POST to this webhook for inbound SMS
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const body = formData.get("Body") as string;
  const from = formData.get("From") as string;
  const to = formData.get("To") as string;
  const sid = formData.get("MessageSid") as string;

  if (!from || !body) {
    return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });
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
