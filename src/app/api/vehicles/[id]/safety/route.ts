import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";

const CACHE: Record<string, { data: unknown; ts: number }> = {};
const TTL = 24 * 60 * 60 * 1000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: { year: true, make: true, model: true },
  });
  if (!vehicle) return apiError("Vehicle not found", 404);

  const key = `safety_${vehicle.year}_${vehicle.make}_${vehicle.model}`;
  if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) return apiSuccess(CACHE[key].data);

  try {
    // First get vehicle variants
    const variantsUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${vehicle.year}/make/${encodeURIComponent(vehicle.make)}/model/${encodeURIComponent(vehicle.model)}`;
    const variantsRes = await fetch(variantsUrl, { signal: AbortSignal.timeout(8000) });
    const variantsJson = await variantsRes.json();

    const variants = variantsJson.Results || [];
    if (variants.length === 0) {
      const result = { ratings: null, variants: [], vehicle };
      CACHE[key] = { data: result, ts: Date.now() };
      return apiSuccess(result);
    }

    // Get ratings for first variant
    const vehicleId = variants[0].VehicleId;
    const ratingsUrl = `https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicleId}`;
    const ratingsRes = await fetch(ratingsUrl, { signal: AbortSignal.timeout(8000) });
    const ratingsJson = await ratingsRes.json();
    const r = ratingsJson.Results?.[0] || {};

    const ratings = {
      overall: r.OverallRating,
      overallFrontCrash: r.OverallFrontCrashRating,
      overallSideCrash: r.OverallSideCrashRating,
      rollover: r.RolloverRating,
      rolloverPossibility: r.RolloverPossibility,
      driverFront: r.DriverFrontRating,
      passengerFront: r.PassengerFrontRating,
      driverSide: r.DriverSideRating,
      passengerSide: r.PassengerSideBARRating,
      driverPole: r.DriverSidePoleRating,
      combinedSideBarrierAndPole: r.CombinedSideBarrierAndPoleRating,
      description: variants[0].VehicleDescription,
    };

    const result = { ratings, variants: variants.slice(0, 5), vehicle };
    CACHE[key] = { data: result, ts: Date.now() };
    return apiSuccess(result);
  } catch {
    return apiSuccess({ ratings: null, variants: [], vehicle });
  }
}
