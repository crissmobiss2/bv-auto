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

  const key = `complaints_${year}_${make}_${model}`;
  if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) return apiSuccess(CACHE[key].data);

  try {
    const params = new URLSearchParams({ make });
    if (model) params.set("model", model);
    if (year) params.set("modelYear", year);

    const res = await fetch(`https://api.nhtsa.gov/complaints/complaintsByVehicle?${params}`, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();

    const complaints = (json.results || []).map((c: {
      odiNumber?: string; dateOfIncident?: string; dateComplaintFiled?: string;
      component?: string; summary?: string; crashOccurred?: boolean;
      injuriesOccurred?: boolean; numberOfInjuries?: number;
    }) => ({
      id: c.odiNumber,
      dateOfIncident: c.dateOfIncident,
      dateFiled: c.dateComplaintFiled,
      component: c.component,
      summary: c.summary,
      crash: c.crashOccurred,
      injury: c.injuriesOccurred,
      injuries: c.numberOfInjuries,
    }));

    const byComponent: Record<string, number> = {};
    for (const c of complaints) {
      const comp = c.component || "OTHER";
      byComponent[comp] = (byComponent[comp] || 0) + 1;
    }
    const componentStats = Object.entries(byComponent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([component, count]) => ({ component, count }));

    const result = { complaints: complaints.slice(0, 50), count: complaints.length, componentStats };
    CACHE[key] = { data: result, ts: Date.now() };
    return apiSuccess(result);
  } catch {
    return apiSuccess({ complaints: [], count: 0, componentStats: [] });
  }
}
