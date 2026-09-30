import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";

// Proxies the free NHTSA vPIC decoder so the client never talks cross-origin.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  if (!rateLimit(`vin:${getIP(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const vin = req.nextUrl.searchParams.get("vin")?.toUpperCase().trim() ?? "";
  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) {
    return NextResponse.json({ error: "Invalid VIN" }, { status: 400 });
  }

  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`,
    { cache: "force-cache" },
  );
  if (!res.ok) return NextResponse.json({ error: "VIN decode failed" }, { status: 502 });

  const json = await res.json() as { Results: { Variable: string; Value: string | null }[] };
  const get = (name: string) => json.Results.find(r => r.Variable === name)?.Value ?? "";

  return NextResponse.json({
    vin,
    year: get("Model Year"),
    make: get("Make"),
    model: get("Model"),
    trim: get("Trim"),
    engine: get("Engine Model") || get("Displacement (L)"),
    transmission: get("Transmission Style"),
    bodyClass: get("Body Class"),
    driveType: get("Drive Type"),
    fuelType: get("Fuel Type - Primary"),
  });
}
