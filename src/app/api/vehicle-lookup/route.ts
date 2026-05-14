import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

const NHTSA = "https://vpic.nhtsa.dot.gov/api/vehicles";

// Top US automotive makes — shown instantly before NHTSA loads
const COMMON_MAKES = [
  "Acura","Alfa Romeo","Aston Martin","Audi","Bentley","BMW","Buick","Cadillac","Chevrolet",
  "Chrysler","Dodge","Ferrari","Fiat","Ford","Genesis","GMC","Honda","Hyundai","Infiniti",
  "Jaguar","Jeep","Kia","Lamborghini","Land Rover","Lexus","Lincoln","Lotus","Maserati",
  "Mazda","McLaren","Mercedes-Benz","Mercury","Mini","Mitsubishi","Nissan","Oldsmobile",
  "Pontiac","Porsche","Ram","Rolls-Royce","Saab","Saturn","Scion","Smart","Subaru","Suzuki",
  "Tesla","Toyota","Volkswagen","Volvo",
];

// Cache NHTSA makes in module scope
let cachedMakes: string[] | null = null;
let cacheTime = 0;
const MAKES_TTL = 24 * 60 * 60 * 1000;

async function getNhtsaMakes(): Promise<string[]> {
  if (cachedMakes && Date.now() - cacheTime < MAKES_TTL) return cachedMakes;
  try {
    const res = await fetch(`${NHTSA}/getallmakes?format=json`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return COMMON_MAKES;
    const json = await res.json();
    const makes: string[] = (json.Results || [])
      .map((r: { Make_Name: string }) => r.Make_Name?.trim())
      .filter(Boolean);
    // Merge: common makes first (in order), then any extras from NHTSA
    const commonSet = new Set(COMMON_MAKES.map((m) => m.toLowerCase()));
    const extras = makes.filter((m) => !commonSet.has(m.toLowerCase())).sort();
    cachedMakes = [...COMMON_MAKES, ...extras];
    cacheTime = Date.now();
    return cachedMakes;
  } catch {
    return COMMON_MAKES;
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const make = searchParams.get("make")?.trim();
  const year = searchParams.get("year")?.trim();
  const q = searchParams.get("q")?.trim().toLowerCase();

  // --- GET ALL MAKES ---
  if (type === "makes") {
    // If no search query, return common makes immediately (fast)
    if (!q) return apiSuccess(COMMON_MAKES);
    // With search query, fetch full NHTSA list and filter
    const all = await getNhtsaMakes();
    const filtered = all.filter((m) => m.toLowerCase().includes(q));
    return apiSuccess(filtered.slice(0, 100));
  }

  // --- GET MODELS FOR MAKE ---
  if (type === "models") {
    if (!make) return apiError("make is required", 400);

    let url: string;
    if (year && /^\d{4}$/.test(year)) {
      url = `${NHTSA}/getmodelsformakeyear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
    } else {
      url = `${NHTSA}/getmodelsformake/${encodeURIComponent(make)}?format=json`;
    }

    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return apiSuccess([]);
      const json = await res.json();

      const models: string[] = (json.Results || [])
        .map((r: { Model_Name: string }) => r.Model_Name?.trim())
        .filter(Boolean)
        .sort();

      const unique = [...new Set(models)];
      const filtered = q ? unique.filter((m) => m.toLowerCase().includes(q)) : unique;
      return apiSuccess(filtered);
    } catch {
      return apiSuccess([]);
    }
  }

  return apiError("type must be 'makes' or 'models'", 400);
}
