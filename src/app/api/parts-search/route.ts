import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

const client = new Anthropic();

// Simulated supplier catalog — swap fetch() calls here once you have API credentials
// from NAPA (api.napaonline.com), Worldpac, or Nexpart
async function searchSupplier(supplier: string, query: string, year: string, make: string, model: string) {
  // TODO: Replace with real supplier API calls when credentials are configured
  // NAPA: POST https://api.napaonline.com/v1/parts/search
  // Worldpac: POST https://speedDIAL.worldpac.com/api/v2/catalog/search
  // Nexpart: GET https://api.nexpart.com/catalog/parts

  // AI-powered parts lookup until real supplier API is connected
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `You are a parts catalog for ${supplier}. Generate realistic parts lookup results.

Vehicle: ${year} ${make} ${model}
Part query: "${query}"

Return JSON array (max 4 results):
[{
  "partNumber": "realistic part number",
  "description": "full part description",
  "brand": "brand name",
  "price": 45.99,
  "coreCharge": 0,
  "inStock": true,
  "stockQty": 3,
  "location": "store/warehouse code",
  "condition": "New",
  "warranty": "12 months / 12,000 miles"
}]

Use realistic pricing and OEM-accurate part numbers. Only return the JSON array.`,
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]).map((p: Record<string, unknown>) => ({ ...p, supplier }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const year = searchParams.get("year") || "";
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";

  if (!query) return apiError("q is required");

  // Search all suppliers in parallel
  const [napa, worldpac, oreilly] = await Promise.allSettled([
    searchSupplier("NAPA Auto Parts", query, year, make, model),
    searchSupplier("Worldpac", query, year, make, model),
    searchSupplier("O'Reilly Auto Parts", query, year, make, model),
  ]);

  const results = [
    ...(napa.status === "fulfilled" ? napa.value : []),
    ...(worldpac.status === "fulfilled" ? worldpac.value : []),
    ...(oreilly.status === "fulfilled" ? oreilly.value : []),
  ];

  return apiSuccess({
    results,
    query,
    vehicle: { year, make, model },
    note: "Connect real supplier API credentials in settings to get live pricing",
  });
}
