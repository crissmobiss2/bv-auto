import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.jobPhoto.findUnique({
    where: { id },
    select: {
      data: true,
      mimeType: true,
      job: { select: { customer: { select: { portalToken: true } } } },
    },
  });
  if (!photo?.data) return new NextResponse("Not found", { status: 404 });

  const { session } = await requireAuth();
  const isStaff = !!session && session.user.role !== "CUSTOMER";
  if (!isStaff) {
    const token = req.nextUrl.searchParams.get("t");
    if (!token || token !== photo.job?.customer?.portalToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
