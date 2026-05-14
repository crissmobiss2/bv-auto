import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  if (!rateLimit(`ai-msg:${getIP(req)}`, 20, 60_000)) {
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
Customer: ${customerName || "the customer"}
${vehicleInfo ? `Vehicle: ${vehicleInfo}` : ""}
${jobInfo ? `Job/Service: ${jobInfo}` : ""}

Message type: ${type}
Tone: ${tone}
Context/What to communicate: ${context}

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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const message = (msg.content[0] as { text: string }).text.trim();
    return apiSuccess({ message });
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : "AI message failed", 500);
  }
}
