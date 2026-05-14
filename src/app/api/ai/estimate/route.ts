import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  if (!rateLimit(`ai-estimate:${getIP(req)}`, 10, 60_000)) {
    return apiError("Too many requests. Please wait a moment.", 429);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError("AI estimate requires ANTHROPIC_API_KEY", 503);
  }

  const body = await req.json();
  const { year, make, model, mileage, complaint, dtcCodes, laborRate = 120 } = body;

  if (!complaint) return apiError("complaint is required", 400);

  const vehicleStr = [year, make, model].filter(Boolean).join(" ") || "vehicle";
  const mileageStr = mileage ? ` with ${Number(mileage).toLocaleString()} miles` : "";
  const dtcStr = dtcCodes?.length ? `\nDTC Codes: ${dtcCodes.join(", ")}` : "";

  const prompt = `You are an expert auto service advisor at a professional repair shop. Labor rate is $${laborRate}/hr.

Vehicle: ${vehicleStr}${mileageStr}${dtcStr}
Customer complaint: ${complaint}

Generate a detailed repair estimate. Respond ONLY with valid JSON:
{
  "jobTitle": "Brief job title (5 words max)",
  "summary": "1-2 sentence explanation for the customer",
  "laborItems": [
    {
      "description": "Labor description",
      "hours": 1.5,
      "unitPrice": ${laborRate},
      "total": 180.00
    }
  ],
  "partItems": [
    {
      "description": "Part name",
      "partNumber": "optional part number",
      "quantity": 1,
      "unitPrice": 45.00,
      "total": 45.00
    }
  ],
  "shopSupplies": 12.00,
  "subtotal": 237.00,
  "notes": "Any important notes for the technician or customer",
  "urgency": "Immediate|Soon|Maintenance",
  "estimatedDays": 1
}

Rules:
- Labor price = hours × $${laborRate}
- Include all likely parts needed (don't under-estimate)
- Part prices should be realistic retail prices
- If multiple repairs needed, include all labor + parts
- Be specific to the ${vehicleStr} — mention common failure points for this vehicle if relevant
- shopSupplies = typically 5-10% of labor, max $25`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { text: string }).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return apiError("AI returned invalid response", 500);

    const result = JSON.parse(jsonMatch[0]);
    // Recalculate subtotal from items to ensure accuracy
    const laborTotal = (result.laborItems || []).reduce((s: number, i: { total: number }) => s + i.total, 0);
    const partsTotal = (result.partItems || []).reduce((s: number, i: { total: number }) => s + i.total, 0);
    result.subtotal = laborTotal + partsTotal + (result.shopSupplies || 0);

    return apiSuccess(result);
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : "AI estimate failed", 500);
  }
}
