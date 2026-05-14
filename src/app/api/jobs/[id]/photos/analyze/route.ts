import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      vehicle: true,
      customer: { select: { firstName: true, lastName: true } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!job) return apiError("Job not found");
  if (!job.photos.length) return apiError("No photos to analyze");

  const imageMessages = await Promise.all(
    job.photos.slice(0, 10).map(async (photo) => {
      const res = await fetch(photo.url);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mediaType = (res.headers.get("content-type") || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data: base64 },
      };
    })
  );

  const vehicleStr = `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}${job.vehicle.trim ? ` ${job.vehicle.trim}` : ""}`;
  const mileage = job.mileageIn ? ` (${job.mileageIn.toLocaleString()} miles)` : "";

  const systemPrompt = `You are an expert automotive technician's assistant. Analyze vehicle inspection photos and produce structured, professional reports for both the shop and the customer.`;

  const userPrompt = `These are inspection photos for a ${vehicleStr}${mileage}. Job: "${job.title}".

Analyze ALL photos carefully and return a JSON object with this exact structure:
{
  "overallCondition": "GOOD|FAIR|POOR|CRITICAL",
  "summary": "2-3 sentence customer-friendly summary of what you observed",
  "findings": [
    {
      "area": "area of vehicle (e.g. Front Brakes, Engine Bay, Tires)",
      "severity": "OK|ADVISORY|ATTENTION_NEEDED|URGENT",
      "description": "what you see",
      "customerNote": "plain-English explanation for the customer",
      "estimatedCost": "rough cost range if repair needed, or null"
    }
  ],
  "immediateRepairs": ["list of repairs needed now"],
  "recommendedServices": ["list of services to recommend soon"],
  "partsIdentified": ["list of visible parts or components"],
  "safetyFlags": ["any safety concerns — brake wear, tire tread, leaks, etc."]
}

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          ...imageMessages,
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  let analysis;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    analysis = JSON.parse(match ? match[0] : raw);
  } catch {
    return apiError("Failed to parse AI analysis. Try again.");
  }

  // Store result back on job checklist field as AI analysis
  await prisma.job.update({
    where: { id },
    data: {
      internalNotes: job.internalNotes
        ? `${job.internalNotes}\n\n[AI Photo Analysis]\n${analysis.summary}`
        : `[AI Photo Analysis]\n${analysis.summary}`,
    },
  });

  return apiSuccess({ analysis, photoCount: job.photos.length });
}
