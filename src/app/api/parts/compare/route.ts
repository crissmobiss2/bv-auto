import { NextRequest } from "next/server";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { description, partNumber, year, make, model } = await req.json();

  const vehicleStr = year && make && model ? `${year} ${make} ${model}` : "generic vehicle";
  const partQuery = partNumber ? `Part number: ${partNumber}. Description: ${description}` : `Description: ${description}`;

  const prompt = `You are an automotive parts pricing expert with knowledge of AutoZone, O'Reilly Auto Parts, NAPA, RockAuto, and Advance Auto Parts.

Vehicle: ${vehicleStr}
${partQuery}

Return realistic price comparison data for this part across major vendors. Use your knowledge of typical pricing as of 2024-2025. Return ONLY valid JSON:

{
  "partDescription": "standardized part name",
  "partNumber": "${partNumber || "varies by brand"}",
  "fitment": "${vehicleStr}",
  "vendors": [
    {
      "vendor": "AutoZone",
      "brand": "brand name",
      "partNumber": "their part number",
      "price": 45.99,
      "coreCharge": 0,
      "availability": "In Stock",
      "quality": "OEM Equivalent",
      "url": null,
      "notes": "any notes"
    }
  ],
  "recommendation": {
    "bestValue": "vendor name",
    "bestQuality": "vendor name",
    "suggestedRetailPrice": 65.00,
    "suggestedMarkup": 35,
    "notes": "brief recommendation"
  },
  "relatedParts": ["list of commonly replaced together parts"]
}

Include at least 4 vendors. Vary prices realistically — don't make them identical.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return apiSuccess(JSON.parse(match ? match[0] : raw));
  } catch {
    return apiSuccess({ error: "Could not parse comparison", raw });
  }
}
