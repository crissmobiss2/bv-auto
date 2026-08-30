import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError } from "@/lib/api-helpers";

const CACHE: Record<string, { data: unknown; ts: number }> = {};
const TTL = 12 * 60 * 60 * 1000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, shopId },
    select: { year: true, make: true, model: true },
  });
  if (!vehicle) return apiError("Vehicle not found", 404);

  const key = `complaints_${vehicle.year}_${vehicle.make}_${vehicle.model}`;
  if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) return apiSuccess(CACHE[key].data);

  try {
    const url = `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();

    const complaints = (json.results || []).map((c: {
      odiNumber?: string; dateOfIncident?: string; dateComplaintFiled?: string;
      component?: string; summary?: string; crashOccurred?: boolean; injuriesOccurred?: boolean;
      numberOfInjuries?: number; numberOfDeaths?: number; productDescription?: string;
    }) => ({
      id: c.odiNumber,
      dateOfIncident: c.dateOfIncident,
      dateFiled: c.dateComplaintFiled,
      component: c.component,
      summary: c.summary,
      crash: c.crashOccurred,
      injury: c.injuriesOccurred,
      injuries: c.numberOfInjuries,
      deaths: c.numberOfDeaths,
    }));

    // Group by component for quick stats
    const byComponent: Record<string, number> = {};
    for (const c of complaints) {
      const comp = c.component || "OTHER";
      byComponent[comp] = (byComponent[comp] || 0) + 1;
    }
    const componentStats = Object.entries(byComponent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([component, count]) => ({ component, count }));

    const result = {
      complaints: complaints.slice(0, 50),
      count: complaints.length,
      componentStats,
      vehicle,
    };
    CACHE[key] = { data: result, ts: Date.now() };
    return apiSuccess(result);
  } catch {
    return apiSuccess({ complaints: [], count: 0, componentStats: [], vehicle });
  }
}
