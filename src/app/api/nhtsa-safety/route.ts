import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

const CACHE: Record<string, { data: unknown; ts: number }> = {};
const TTL = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const year = searchParams.get("year") || "";

  if (!make) return apiError("make is required", 400);

  const key = `safety_${year}_${make}_${model}`;
  if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) return apiSuccess(CACHE[key].data);

  try {
    const varUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`;
    const varRes = await fetch(varUrl, { signal: AbortSignal.timeout(8000) });
    const varJson = await varRes.json();
    const variants = varJson.Results || [];

    if (variants.length === 0) {
      const result = { ratings: null, variants: [] };
      CACHE[key] = { data: result, ts: Date.now() };
      return apiSuccess(result);
    }

    const vehicleId = variants[0].VehicleId;
    const ratingsRes = await fetch(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicleId}`, { signal: AbortSignal.timeout(8000) });
    const ratingsJson = await ratingsRes.json();
    const r = ratingsJson.Results?.[0] || {};

    const result = {
      ratings: {
        overall: r.OverallRating,
        overallFrontCrash: r.OverallFrontCrashRating,
        overallSideCrash: r.OverallSideCrashRating,
        rollover: r.RolloverRating,
        rolloverPossibility: r.RolloverPossibility,
        driverFront: r.DriverFrontRating,
        passengerFront: r.PassengerFrontRating,
        driverSide: r.DriverSideRating,
        driverPole: r.DriverSidePoleRating,
        description: variants[0].VehicleDescription,
      },
      variants: variants.slice(0, 5),
    };
    CACHE[key] = { data: result, ts: Date.now() };
    return apiSuccess(result);
  } catch {
    return apiSuccess({ ratings: null, variants: [] });
  }
}
