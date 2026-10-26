import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, UNTRUSTED_NOTE, aiFailure, extractJson, untrusted } from "@/lib/ai";

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

  const rate = Number(laborRate);
  const safeLaborRate = Number.isFinite(rate) && rate > 0 ? rate : 120;
  const vehicleStr = [year, make, model].filter(Boolean).join(" ") || "vehicle";
  const mileageStr = mileage ? ` with ${Number(mileage).toLocaleString()} miles` : "";
  const dtcStr = dtcCodes?.length ? `\nDTC Codes: ${dtcCodes.join(", ")}` : "";

  const prompt = `You are an expert auto service advisor at a professional repair shop. Labor rate is $${safeLaborRate}/hr.

${UNTRUSTED_NOTE}

Vehicle: ${untrusted("vehicle", vehicleStr, 200)}${mileageStr}${dtcStr && untrusted("dtc", dtcStr, 500)}
Customer complaint: ${untrusted("complaint", complaint)}

Generate a detailed repair estimate. Respond ONLY with valid JSON:
{
  "jobTitle": "Brief job title (5 words max)",
  "summary": "1-2 sentence explanation for the customer",
  "laborItems": [
    {
      "description": "Labor description",
      "hours": 1.5,
      "unitPrice": ${safeLaborRate},
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
- Labor price = hours × $${safeLaborRate}
- Include all likely parts needed (don't under-estimate)
- Part prices should be realistic retail prices
- If multiple repairs needed, include all labor + parts
- Be specific to the ${vehicleStr} — mention common failure points for this vehicle if relevant
- shopSupplies = typically 5-10% of labor, max $25`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: AI_MODELS.estimate,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { text: string }).text;
    const result = extractJson(text) as Record<string, unknown> | null;
    if (!result || typeof result !== "object") return apiError("The AI returned an unreadable estimate. Please try again.", 502);
    const money = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
    };

    // The model sometimes returns numeric strings. Coerce everything and
    // recompute each line so a string "45.00" can never concatenate into
    // "180.0045.00" and produce a nonsense estimate.
    const laborItems = (Array.isArray(result.laborItems) ? result.laborItems : []).map(
      (item: Record<string, unknown>) => {
        const hours = money(item.hours);
        const unitPrice = money(item.unitPrice);
        return { ...item, hours, unitPrice, total: Math.round(hours * unitPrice * 100) / 100 };
      },
    );
    const partItems = (Array.isArray(result.partItems) ? result.partItems : []).map(
      (item: Record<string, unknown>) => {
        const quantity = money(item.quantity) || 1;
        const unitPrice = money(item.unitPrice);
        return { ...item, quantity, unitPrice, total: Math.round(quantity * unitPrice * 100) / 100 };
      },
    );
    const shopSupplies = money(result.shopSupplies);
    const laborTotal = laborItems.reduce((sum: number, item: { total: number }) => sum + item.total, 0);
    const partsTotal = partItems.reduce((sum: number, item: { total: number }) => sum + item.total, 0);

    result.laborItems = laborItems;
    result.partItems = partItems;
    result.shopSupplies = shopSupplies;
    result.subtotal = Math.round((laborTotal + partsTotal + shopSupplies) * 100) / 100;

    return apiSuccess(result);
  } catch (e: unknown) {
    return aiFailure(e, "estimate");
  }
}
