import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year");
  const make  = searchParams.get("make");
  const model = searchParams.get("model");
  const event = searchParams.get("event"); // "windshield_replacement", "alignment", "bumper_repair", etc.

  if (!year || !make || !model) {
    return NextResponse.json({ error: "year, make, model required" }, { status: 400 });
  }

  // First check our vehicle spec database
  const spec = await prisma.vehicleSpec.findFirst({
    where: {
      year: parseInt(year),
      make: { equals: make, mode: "insensitive" },
      model: { equals: model, mode: "insensitive" },
    },
    select: { adasFeatures: true, adasCalRequired: true, engine: true },
  });

  // Supplement with AI for detailed calibration procedures
  const vehicleStr = `${year} ${make} ${model}`;
  const eventStr = event ? `after: ${event.replace(/_/g, " ")}` : "general overview";

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `You are an ADAS calibration expert. For the ${vehicleStr}, provide ADAS calibration requirements ${eventStr}.

Return JSON:
{
  "systems": [
    {
      "name": "Forward Collision Warning / AEB",
      "sensor": "Front radar + front camera",
      "calibrationType": "static | dynamic | both",
      "requiredAfter": ["windshield replacement", "front bumper repair", "front-end collision", "wheel alignment"],
      "procedure": "Brief procedure description",
      "specialEquipment": ["target board", "scan tool with ADAS function"],
      "estimatedTime": "1-2 hours",
      "notes": "..."
    }
  ],
  "generalNotes": "...",
  "safetyWarning": "..."
}`
      }],
    });

    const text = (response.content[0] as { text: string }).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const aiData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return NextResponse.json({
      vehicle: vehicleStr,
      fromDatabase: {
        features: spec?.adasFeatures || [],
        calibrationEvents: spec?.adasCalRequired || [],
      },
      detailed: aiData,
    });
  } catch {
    return NextResponse.json({
      vehicle: vehicleStr,
      fromDatabase: {
        features: spec?.adasFeatures || [],
        calibrationEvents: spec?.adasCalRequired || [],
      },
      detailed: null,
      error: "AI detail unavailable",
    });
  }
}
