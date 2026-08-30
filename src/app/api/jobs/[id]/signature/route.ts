import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const signatureSchema = z.object({
  signerName: z.string().min(1),
  signerRole: z.string().default("Customer"),
  imageData: z.string().min(1), // base64 PNG
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const parsed = signatureSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const job = await prisma.job.findFirst({ where: { id, shopId } });
  if (!job) return apiError("Job not found", 404);

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
