import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

const client = new Anthropic();

const CACHE: Record<string, { data: unknown; ts: number }> = {};
const TTL = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError("AI service not configured.", 503);
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || "";
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const mileage = searchParams.get("mileage") || "0";

  if (!make || !model) return apiError("make and model are required", 400);

  const cacheKey = `maint_${year}_${make}_${model}`;
  if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].ts < TTL) {
    return apiSuccess(CACHE[cacheKey].data);
  }

  const vehicleStr = [year, make, model].filter(Boolean).join(" ");
  const currentMiles = parseInt(mileage) || 0;

  const prompt = `You are an expert automotive technician. Generate a comprehensive maintenance schedule for a ${vehicleStr} currently at ${currentMiles.toLocaleString()} miles.

Respond with JSON in this exact format:
{
  "services": [
    {
      "service": "Service name",
      "intervalMiles": 5000,
      "intervalMonths": 6,
      "lastDue": "mileage when last due based on current ${currentMiles} miles",
      "nextDue": "next due mileage from current mileage",
      "status": "overdue|due_soon|ok",
      "priority": "critical|high|medium|low",
      "estimatedCost": "$XX-$XX",
      "notes": "vehicle-specific notes, oil type, fluid specs etc.",
      "category": "Engine|Transmission|Brakes|Tires|Fluids|Filters|Electrical|Cooling|Suspension|Safety"
    }
  ],
  "fluidSpecs": {
    "engineOil": "e.g. 0W-20 Full Synthetic",
    "oilCapacity": "e.g. 4.5 quarts",
    "transmissionFluid": "type and capacity",
    "coolant": "type and mix ratio",
    "brakeFluid": "DOT rating",
    "powerSteering": "type if applicable",
    "differentialFluid": "type if applicable"
  },
  "criticalNotes": "Any vehicle-specific warnings, known issues, or important maintenance notes",
  "timingBelt": {
    "applicable": true,
    "interval": "60,000-105,000 miles",
    "notes": "Replace with water pump"
  }
}

Include all manufacturer-recommended services for this specific vehicle. Be specific about fluid types, capacities, and part specifications. Include timing belt/chain info, spark plug type and gap, and any vehicle-specific quirks. Services should be ordered by priority/status.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return apiError("Failed to generate maintenance schedule", 500);

  const schedule = JSON.parse(jsonMatch[0]);
  const result = { schedule, vehicle: { year, make, model, mileage: currentMiles } };
  CACHE[cacheKey] = { data: result, ts: Date.now() };
  return apiSuccess(result);
}
