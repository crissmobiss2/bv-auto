import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, shopId },
    include: {
      maintenanceIntervals: { orderBy: { lastServiceDate: "desc" }, take: 20 },
      jobs: {
        where: { status: { in: ["COMPLETED", "PAID"] } },
        orderBy: { completedAt: "desc" },
        take: 20,
        select: {
          title: true, description: true, completedAt: true, mileageIn: true, mileageOut: true,
          parts: { select: { description: true, partNumber: true } },
        },
      },
    },
  });

  if (!vehicle) return apiError("Vehicle not found");

  const currentMileage = vehicle.mileage || 0;
  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
  const engineStr = vehicle.engine || "unknown engine";

  const serviceHistory = vehicle.jobs.map(j =>
    `- ${j.title} (${j.mileageIn ? j.mileageIn.toLocaleString() + " mi" : "unknown mi"}, ${j.completedAt ? new Date(j.completedAt).toLocaleDateString() : "date unknown"})`
  ).join("\n") || "No service history on file";

  const intervals = vehicle.maintenanceIntervals.map(m =>
    `- ${m.serviceName}: last done ${m.lastServiceDate ? new Date(m.lastServiceDate).toLocaleDateString() : "never"} at ${m.lastServiceMiles?.toLocaleString() || "?"} miles, interval every ${m.intervalMiles?.toLocaleString() || "?"} miles / ${m.intervalDays ? Math.round(m.intervalDays / 30) + " months" : "?"}`
  ).join("\n") || "No maintenance intervals recorded";

  const prompt = `You are an expert automotive service advisor. Predict upcoming maintenance needs for this vehicle.

Vehicle: ${vehicleStr}
Engine: ${engineStr}
Current Mileage: ${currentMileage.toLocaleString()} miles
Transmission: ${vehicle.transmission || "unknown"}

Service History:
${serviceHistory}

Tracked Maintenance Intervals:
${intervals}

Based on manufacturer schedules, industry standards, and this vehicle's history, predict what this vehicle will need in the next 30, 60, and 90 days. Consider mileage progression (assume ~1,200 miles/month average).

Return ONLY valid JSON:
{
  "predictions": [
    {
      "service": "service name",
      "urgency": "NOW|30_DAYS|60_DAYS|90_DAYS|MONITOR",
      "confidence": 85,
      "reason": "why this is predicted",
      "estimatedCost": "$X–$Y",
      "mileageDue": 12345,
      "canUpsell": true,
      "upsellNote": "mention when scheduling oil change"
    }
  ],
  "vehicleHealthSummary": "2 sentence plain-English health summary",
  "totalEstimatedCost30": 0,
  "totalEstimatedCost60": 0,
  "totalEstimatedCost90": 0
}`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const result = JSON.parse(match ? match[0] : raw);
    return apiSuccess({ ...result, vehicle: { id: vehicle.id, year: vehicle.year, make: vehicle.make, model: vehicle.model, mileage: currentMileage } });
  } catch {
    return apiError("Failed to parse prediction. Try again.");
  }
}
