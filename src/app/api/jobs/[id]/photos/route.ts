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
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only upload photos to jobs assigned to you", 403);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caption = formData.get("caption") as string | null;

  if (!file) return apiError("No file provided");
  if (file.size > 10 * 1024 * 1024) return apiError("File too large (max 10MB)", 413);

  // Only raster images. Never allow SVG/HTML here: the bytes are served back
  // from our own origin and could otherwise execute as stored XSS.
  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return apiError("Unsupported image type. Use JPEG, PNG, WebP, HEIC, or HEIF.", 415);
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const filename = `jobs/${id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const blob = await put(filename, file, { access: "public", contentType: file.type });
    const photo = await prisma.jobPhoto.create({
      data: {
        jobId: id,
        uploadedById: session!.user.id,
        url: blob.url,
        caption: caption || undefined,
      },
    });
    return apiSuccess(photo, 201);
  }

  // No object storage configured — persist the image bytes in Postgres
  // and serve them back through /api/photos/[id].
  const bytes = Buffer.from(await file.arrayBuffer());
  const photo = await prisma.jobPhoto.create({
    data: {
      jobId: id,
      uploadedById: session!.user.id,
      url: "",
      data: bytes,
      mimeType: file.type || "image/jpeg",
      caption: caption || undefined,
    },
  });
  await prisma.jobPhoto.update({ where: { id: photo.id }, data: { url: `/api/photos/${photo.id}` } });

  return apiSuccess({ ...photo, url: `/api/photos/${photo.id}` }, 201);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id: jobId } = await params;
  const { photoId } = await req.json();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { technicianId: true },
  });
  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only delete photos from jobs assigned to you", 403);
  }

  const photo = await prisma.jobPhoto.findFirst({ where: { id: String(photoId), jobId } });
  if (!photo) return apiError("Photo not found", 404);

  await prisma.jobPhoto.delete({ where: { id: photo.id } });
  return apiSuccess({ deleted: true });
}
