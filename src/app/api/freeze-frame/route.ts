import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";

// Diagnostic assist: analyzes the technician's ACTUAL freeze-frame / live data.
// Kept (not fabricating a catalog) but gated, rate-limited, and clearly labeled
// as an AI aid to verify — never an authoritative source.
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }
  if (!rateLimit(`freeze-frame:${session!.user.id}:${getIP(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
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
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as { text: string }).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Could not analyze this data" }, { status: 502 });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      ...parsed,
      _disclaimer: "AI diagnostic aid — verify against measured values and OEM procedures before repair.",
    });
  } catch (err) {
    console.error("[freeze-frame]", err);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 502 });
  }
}
