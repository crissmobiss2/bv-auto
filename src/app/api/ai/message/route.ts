import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, UNTRUSTED_NOTE, aiFailure, untrusted } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  if (!(await rateLimit(`ai-msg:${getIP(req)}`, 20, 60_000))) {
    return apiError("Too many requests.", 429);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError("AI messaging requires ANTHROPIC_API_KEY", 503);
  }

  const body = await req.json();
  const { context, tone = "friendly", type = "general", customerName, vehicleInfo, jobInfo } = body;

  if (!context) return apiError("context is required", 400);

  const prompt = `You are a professional auto shop service advisor drafting a text message to a customer.

Shop name: B&V Mobile Auto
${UNTRUSTED_NOTE}

Customer first name: ${customerName ? untrusted("customer", String(customerName).trim().split(/\s+/)[0], 40) : "the customer"}
${vehicleInfo ? `Vehicle: ${untrusted("vehicle", vehicleInfo, 200)}` : ""}
${jobInfo ? `Job/Service: ${untrusted("job", jobInfo, 500)}` : ""}

Message type: ${untrusted("type", type, 40)}
Tone: ${untrusted("tone", tone, 40)}
Context/What to communicate: ${untrusted("context", context)}

Write a professional, concise SMS message (under 160 characters ideally, 320 max).
Rules:
- Address the customer by first name if provided
- Be warm but professional
- Include relevant vehicle info if applicable
- End with a call to action if appropriate
- Do NOT include quotes around the message
- Output ONLY the message text, nothing else`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: AI_MODELS.message,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const message = raw.trim().replace(/^["']|["']$/g, "").slice(0, 320);
    if (!message) return apiError("The AI returned an empty message. Please try again.", 502);
    return apiSuccess({ message });
  } catch (e: unknown) {
    return aiFailure(e, "message");
  }
}
