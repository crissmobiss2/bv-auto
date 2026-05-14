import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const vin = new URL(req.url).searchParams.get("vin")?.trim().toUpperCase();
  if (!vin || vin.length !== 17) return apiError("VIN must be exactly 17 characters", 400);

  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) return apiError("VIN lookup service unavailable", 502);

  const json = await res.json();
  const results: { Variable: string; Value: string | null }[] = json.Results || [];

  const get = (name: string) => {
    const val = results.find((r) => r.Variable === name)?.Value;
    return val && val !== "Not Applicable" && val !== "0" ? val : null;
  };

  const year = get("Model Year");
  const make = get("Make");
  const model = get("Model");

  if (!year || !make || !model) {
    return apiError("Could not decode VIN — check that it is correct", 422);
  }

  const cylinders = get("Engine Number of Cylinders");
  const displacement = get("Displacement (L)");
  const fuelType = get("Fuel Type - Primary");
  const transmission = get("Transmission Style");
  const driveType = get("Drive Type");
  const trim = get("Trim") || get("Trim2");
  const bodyClass = get("Body Class");

  let engineStr = "";
  if (displacement) engineStr += `${parseFloat(displacement).toFixed(1)}L`;
  if (cylinders) engineStr += ` V${cylinders}`;
  if (fuelType && fuelType !== "Gasoline") engineStr += ` ${fuelType}`;
  engineStr = engineStr.trim();

  return apiSuccess({
    vin,
    year: parseInt(year),
    make: make.charAt(0) + make.slice(1).toLowerCase(),
    model,
    trim: trim || null,
    engine: engineStr || null,
    fuelType: fuelType || null,
    transmission: transmission || null,
    driveType: driveType || null,
    bodyClass: bodyClass || null,
  });
}
