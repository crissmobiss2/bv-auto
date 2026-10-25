import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const signatureSchema = z.object({
  signerName: z.string().min(1).max(120),
  signerRole: z.string().max(50).default("Customer"),
  // Base64 PNG. Cap at ~2 MB of encoded data so a single signature cannot
  // exhaust storage or make job detail payloads enormous.
  imageData: z.string().min(1).max(2_000_000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const parsed = signatureSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only capture signatures for jobs assigned to you", 403);
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";

  const signature = await prisma.signature.create({
    data: {
      jobId: id,
      signerName: parsed.data.signerName,
      signerRole: parsed.data.signerRole,
      imageData: parsed.data.imageData,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || undefined,
    },
  });

  return apiSuccess(signature, 201);
}
