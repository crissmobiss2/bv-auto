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

  const key = `tsb_${vehicle.year}_${vehicle.make}_${vehicle.model}`;
  if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) return apiSuccess(CACHE[key].data);

  try {
    const url = `https://api.nhtsa.gov/tsbs/tsbsByVehicle?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();

    const tsbs = (json.results || []).map((t: {
      tsbId?: string; tsbNumber?: string; tsbDate?: string; tsbTitle?: string;
      summaryDescription?: string; affectedSystemsDesc?: string; submissionType?: string;
      mfrName?: string;
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

    const result = { tsbs, count: tsbs.length, vehicle };
    CACHE[key] = { data: result, ts: Date.now() };
    return apiSuccess(result);
  } catch {
    return apiSuccess({ tsbs: [], count: 0, vehicle });
  }
}
