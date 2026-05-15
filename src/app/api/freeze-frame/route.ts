import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dtcCode, freezeFrameData, year, make, model, engine } = body;

  if (!freezeFrameData) {
    return NextResponse.json({ error: "freezeFrameData required" }, { status: 400 });
  }

  const vehicleCtx = year && make ? `${year} ${make} ${model || ""} ${engine || ""}`.trim() : "Unknown vehicle";

  const prompt = `You are an expert automotive diagnostic technician analyzing OBD-II freeze frame data.

Vehicle: ${vehicleCtx}
${dtcCode ? `Stored DTC: ${dtcCode}` : ""}

Freeze Frame / Live Data:
${typeof freezeFrameData === "string" ? freezeFrameData : JSON.stringify(freezeFrameData, null, 2)}

Analyze this data and provide:
1. **What the data tells you** — what was the engine doing when the fault occurred?
2. **Key abnormal readings** — which PIDs are out of range and what do they indicate?
3. **Root cause analysis** — what do these values point to as the likely cause?
4. **Diagnostic next steps** — what to test/check based on this data
5. **Urgency assessment** — is this safe to drive?

Format as JSON:
{
  "summary": "...",
  "abnormalReadings": [{"pid": "...", "value": "...", "normalRange": "...", "significance": "..."}],
  "rootCauses": ["..."],
  "diagnosticSteps": ["..."],
  "urgency": "Immediate | Monitor | Low",
  "driveable": true | false,
  "drivableNotes": "..."
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as { text: string }).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
