import { NextRequest } from "next/server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  // 10 AI diagnoses per minute per IP
  if (!rateLimit(`ai:${getIP(req)}`, 10, 60_000)) {
    return apiError("Too many requests. Please wait a moment.", 429);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError("AI diagnosis is not configured (missing ANTHROPIC_API_KEY)", 503);
  }

  const body = await req.json();
  const { year, make, model, mileage, symptoms, dtcCodes, priorRepairs, stream: wantStream, jobId } = body;

  if (!symptoms && (!dtcCodes || dtcCodes.length === 0)) {
    return apiError("symptoms or dtcCodes are required", 400);
  }

  const vehicleInfo = [year, make, model].filter(Boolean).join(" ") || "Unknown vehicle";
  const mileageInfo = mileage ? ` with ${Number(mileage).toLocaleString()} miles` : "";
  const dtcInfo = dtcCodes?.length ? `\nDTC Codes: ${dtcCodes.join(", ")}` : "";
  const priorInfo = priorRepairs ? `\nRecent repairs: ${priorRepairs}` : "";

  const prompt = `You are an expert ASE Master Technician with 20+ years of experience. A customer has brought in their vehicle.

Vehicle: ${vehicleInfo}${mileageInfo}${dtcInfo}${priorInfo}
Customer-reported symptoms: ${symptoms || "None described"}

Provide a professional diagnostic assessment. Respond ONLY with valid JSON in this exact format:
{
  "summary": "One sentence summary of the likely root cause",
  "confidence": 85,
  "diagnoses": [
    {
      "rank": 1,
      "cause": "Most likely cause",
      "probability": "High/Medium/Low",
      "confidence": 90,
      "explanation": "Brief technical explanation",
      "repairNeeded": "Specific repair recommendation",
      "estimatedLaborHours": 1.5,
      "estimatedPartsCost": "$X - $Y",
      "estimatedLaborCost": "$X - $Y",
      "urgency": "Immediate/Soon/Monitor"
    }
  ],
  "recommendedServices": [
    { "service": "Service name", "reason": "Why recommended", "priority": "High/Medium/Low" }
  ],
  "safetyNotes": "Any safety concerns the advisor should communicate",
  "diagnosticSteps": ["Step 1", "Step 2", "Step 3"]
}

Provide 2-4 diagnoses ranked by probability. Be specific to the ${vehicleInfo} — mention known issues for this vehicle if relevant. Include a confidence percentage (0-100) for each diagnosis and an overall confidence score.`;

  async function saveToJobNotes(result: Record<string, unknown>) {
    if (!jobId || !session?.user?.id) return;
    const noteLines = [
      `**AI Diagnosis** (${vehicleInfo})`,
      `Summary: ${result.summary}`,
      result.confidence ? `Overall confidence: ${result.confidence}%` : "",
      "",
      ...(Array.isArray(result.diagnoses)
        ? (result.diagnoses as Array<Record<string, unknown>>).map(
            (d, i) =>
              `${i + 1}. ${d.cause} (${d.probability}, ${d.confidence}%) — ${d.repairNeeded}`
          )
        : []),
      result.safetyNotes ? `\nSafety: ${result.safetyNotes}` : "",
    ].filter(Boolean);
    await prisma.note.create({
      data: { jobId, authorId: session.user.id, content: noteLines.join("\n"), isInternal: true },
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Streaming mode — client gets text/event-stream
  if (wantStream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }],
          });

          let fullText = "";
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullText += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }

          // Send the final parsed result
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const result = JSON.parse(jsonMatch[0]);
              await saveToJobNotes(result).catch(() => {});
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true, result })}\n\n`)
              );
            } catch {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true, error: "Parse failed" })}\n\n`)
              );
            }
          }
          controller.close();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, error: msg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming (default)
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { text: string }).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return apiError("AI returned invalid response", 500);

    const result = JSON.parse(jsonMatch[0]);
    await saveToJobNotes(result).catch(() => {});
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI diagnosis failed";
    return apiError(msg, 500);
  }
}
