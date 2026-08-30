import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({ where: { id, shopId }, select: { vin: true, year: true, make: true, model: true } });
  if (!vehicle) return apiError("Vehicle not found", 404);

  const results: { recalls: unknown[]; complaints: unknown[] } = { recalls: [], complaints: [] };

  try {
    if (vehicle.vin) {
      const recallRes = await fetch(
        `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`,
        { next: { revalidate: 3600 } }
      );
      if (recallRes.ok) {
        const data = await recallRes.json();
        results.recalls = (data.results || []).map((r: Record<string, string>) => ({
          id: r.NHTSACampaignNumber,
          component: r.Component,
          summary: r.Summary,
          consequence: r.Consequence,
          remedy: r.Remedy,
          reportedDate: r.ReportReceivedDate,
        }));
      }
    }

    // Also fetch by make/model/year (catches VIN-less vehicles)
    if (!vehicle.vin) {
      const recallRes = await fetch(
        `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`,
        { next: { revalidate: 3600 } }
      );
      if (recallRes.ok) {
        const data = await recallRes.json();
        results.recalls = (data.results || []).map((r: Record<string, string>) => ({
          id: r.NHTSACampaignNumber,
          component: r.Component,
          summary: r.Summary,
          consequence: r.Consequence,
          remedy: r.Remedy,
          reportedDate: r.ReportReceivedDate,
        }));
      }
    }
  } catch {
    // NHTSA API unavailable — return empty
  }

  return apiSuccess(results);
}
