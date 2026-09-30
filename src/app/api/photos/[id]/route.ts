import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const photo = await prisma.jobPhoto.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });
  if (!photo?.data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
