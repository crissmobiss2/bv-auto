import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

const client = new Anthropic();

// Live PartsTech catalog — activates automatically when PARTSTECH_API_KEY is set.
// PartsTech aggregates NAPA, Worldpac, Advance, O'Reilly and 4000+ suppliers under
// one API (docs: api.partstech.com). Tune the endpoint/body to your account tier.
async function searchPartsTech(query: string, year: string, make: string, model: string) {
  const apiKey = process.env.PARTSTECH_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.partstech.com/catalog/v2/parts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      searchTerm: query,
      vehicle: year || make || model ? { year, make, model } : undefined,
      locationId: process.env.PARTSTECH_LOCATION_ID || undefined,
      limit: 20,
    }),
  });
  if (!res.ok) throw new Error(`PartsTech ${res.status}`);

  const data = await res.json();
  const parts = data?.parts || data?.results || data || [];
  return (Array.isArray(parts) ? parts : []).slice(0, 20).map((p: Record<string, unknown>) => ({
    partNumber: p.partNumber || p.part_number || "",
    description: p.description || p.name || "",
    brand: (p.brand as Record<string, string>)?.brandName || p.brand || "",
    price: Number((p.pricing as Record<string, unknown>)?.list ?? p.price ?? 0),
    coreCharge: Number(p.coreCharge ?? 0),
    inStock: !!(p.inStock ?? p.quantity),
    stockQty: Number(p.quantity ?? p.stockQty ?? 0),
    location: p.supplierName || p.supplier || "",
    condition: p.condition || "New",
    warranty: p.warranty || "",
    supplier: p.supplierName || "PartsTech",
    live: true,
  }));
}

// AI-estimated catalog fallback — used when no supplier API credentials are set.
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

  // Prefer the live PartsTech catalog when credentials are configured;
  // otherwise fall back to AI-estimated pricing per supplier.
  const live = await searchPartsTech(query, year, make, model).catch(() => []);
  let results: unknown[] = live;

  if (!live.length) {
    const [napa, worldpac, oreilly] = await Promise.allSettled([
      searchSupplier("NAPA Auto Parts", query, year, make, model),
      searchSupplier("Worldpac", query, year, make, model),
      searchSupplier("O'Reilly Auto Parts", query, year, make, model),
    ]);
    results = [
      ...(napa.status === "fulfilled" ? napa.value : []),
      ...(worldpac.status === "fulfilled" ? worldpac.value : []),
      ...(oreilly.status === "fulfilled" ? oreilly.value : []),
    ];
  }

  return apiSuccess({
    results,
    query,
    vehicle: { year, make, model },
    live: live.length > 0,
    note: live.length
      ? "Live supplier catalog via PartsTech"
      : "AI-estimated results — add PARTSTECH_API_KEY for live supplier pricing and stock",
  });
}
