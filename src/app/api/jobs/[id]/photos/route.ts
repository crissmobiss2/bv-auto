import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return apiError("Job not found", 404);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caption = formData.get("caption") as string | null;

  if (!file) return apiError("No file provided");

  const filename = `jobs/${id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;

  let url: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, file, { access: "public" });
    url = blob.url;
  } else {
    // Dev fallback — store as data URL (not for production)
    url = `https://placehold.co/400x300?text=Photo+Upload`;
    console.log("[BLOB STUB] Vercel Blob not configured — using placeholder");
  }

  const photo = await prisma.jobPhoto.create({
    data: {
      jobId: id,
      uploadedById: session!.user.id,
      url,
      caption: caption || undefined,
    },
  });

  return apiSuccess(photo, 201);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id: jobId } = await params;
  const { photoId } = await req.json();

  const photo = await prisma.jobPhoto.findFirst({ where: { id: photoId, jobId } });
  if (!photo) return apiError("Photo not found", 404);

  await prisma.jobPhoto.delete({ where: { id: photoId } });
  return apiSuccess({ deleted: true });
}
