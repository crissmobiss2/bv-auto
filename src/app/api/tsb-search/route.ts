import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

const CACHE: Record<string, { data: unknown; ts: number }> = {};
const TTL = 12 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const year = searchParams.get("year") || "";

  if (!make) return apiError("make is required", 400);

  const key = `tsb_${year}_${make}_${model}`;
  if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) return apiSuccess(CACHE[key].data);

  try {
    const params = new URLSearchParams({ make });
    if (model) params.set("model", model);
    if (year) params.set("modelYear", year);

    const url = `https://api.nhtsa.gov/tsbs/tsbsByVehicle?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();

    const tsbs = (json.results || []).map((t: {
      tsbId?: string; tsbNumber?: string; tsbDate?: string; tsbTitle?: string;
      summaryDescription?: string; affectedSystemsDesc?: string;
      submissionType?: string; mfrName?: string;
    }) => ({
      id: t.tsbId,
      number: t.tsbNumber,
      date: t.tsbDate,
      title: t.tsbTitle,
      summary: t.summaryDescription,
      affectedSystems: t.affectedSystemsDesc,
      type: t.submissionType,
      manufacturer: t.mfrName,
    }));

    const result = { tsbs, count: tsbs.length };
    CACHE[key] = { data: result, ts: Date.now() };
    return apiSuccess(result);
  } catch {
    return apiSuccess({ tsbs: [], count: 0 });
  }
}
