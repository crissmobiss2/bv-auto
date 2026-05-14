import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError("AI service not configured. Add ANTHROPIC_API_KEY to environment variables.", 503);
  }

  const { year, make, model, mileage, repair, dtcCodes, symptoms } = await req.json();
  if (!repair) return apiError("repair description is required", 400);

  const vehicleStr = [year, make, model].filter(Boolean).join(" ") || "Unknown vehicle";

  const prompt = `You are an expert automotive technician with 25+ years experience, ASE Master Certified.
Generate a comprehensive, professional repair guide for the following:

Vehicle: ${vehicleStr}${mileage ? ` (${mileage} miles)` : ""}
Repair/Service: ${repair}
${dtcCodes?.length ? `DTC Codes Present: ${dtcCodes.join(", ")}` : ""}
${symptoms ? `Symptoms: ${symptoms}` : ""}

Respond with a JSON object in this exact format:
{
  "title": "Repair guide title",
  "overview": "Brief overview of the repair",
  "difficulty": "Beginner|Intermediate|Advanced|Professional",
  "estimatedTime": "e.g. 2-3 hours",
  "laborRate": "estimated labor cost range",
  "safetyWarnings": ["warning 1", "warning 2"],
  "toolsRequired": [
    { "tool": "tool name", "notes": "optional notes" }
  ],
  "partsRequired": [
    { "part": "part name", "partNumber": "OEM or aftermarket part number if known", "qty": 1, "estimatedCost": "$XX-$XX" }
  ],
  "fluidSpecs": [
    { "fluid": "fluid type", "spec": "specification e.g. 5W-30 Full Synthetic", "capacity": "amount if applicable" }
  ],
  "steps": [
    { "step": 1, "title": "Step title", "description": "Detailed step description", "tip": "optional pro tip", "torqueSpec": "optional e.g. 18 ft-lbs" }
  ],
  "torqueSpecs": [
    { "component": "component name", "spec": "torque value and unit" }
  ],
  "commonMistakes": ["mistake 1", "mistake 2"],
  "proTips": ["tip 1", "tip 2"],
  "postRepairChecks": ["check 1", "check 2"],
  "relatedServices": ["service 1", "service 2"],
  "knownIssues": "Any known TSBs, recalls, or common problems specific to this vehicle/repair"
}

Be specific to the vehicle year/make/model when possible. Include actual torque specs, part numbers, and fluid specifications that apply to this exact vehicle. This guide should be better than what AllData or Mitchell 1 ProDemand provides.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return apiError("Failed to generate repair guide", 500);

  const guide = JSON.parse(jsonMatch[0]);
  return apiSuccess({ guide, vehicle: { year, make, model, mileage } });
}
