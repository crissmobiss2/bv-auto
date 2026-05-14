import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

const client = new Anthropic();

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) return apiError("AI not configured", 503);

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || "";
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const repair = searchParams.get("repair") || "";

  if (!repair) return apiError("repair is required");

  const cacheKey = `${year}_${make}_${model}_${repair}`.toLowerCase().replace(/\s+/g, "_");

  const cached = await prisma.laborTimeCache.findUnique({ where: { cacheKey } });
  if (cached) return apiSuccess(cached);

  const vehicleStr = [year, make, model].filter(Boolean).join(" ") || "standard vehicle";

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `You are a flat rate labor time expert (Mitchell 1 / AllData standard).

Give the flat rate labor time for: "${repair}" on a ${vehicleStr}.

Respond ONLY with JSON:
{
  "laborHours": 2.5,
  "skillLevel": "Intermediate",
  "notes": "Brief note on what's included, e.g. includes R&R and adjustment"
}

Use industry-standard flat rate times. Be specific to the vehicle if possible. laborHours should be a decimal number.`,
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return apiError("Failed to get labor time");

  let data: { laborHours?: number; skillLevel?: string; notes?: string };
  try {
    data = JSON.parse(match[0]);
  } catch {
    return apiError("Failed to parse labor time response");
  }

  const record = await prisma.laborTimeCache.create({
    data: {
      cacheKey,
      year,
      make,
      model,
      repair,
      laborHours: Number(data.laborHours),
      skillLevel: data.skillLevel || "Intermediate",
      notes: data.notes,
    },
  });

  return apiSuccess(record);
}
