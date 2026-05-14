import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || "https://g.page/r/review";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const review = await prisma.reviewRequest.findUnique({
    where: { reviewToken: token },
  });

  if (review && !review.clickedAt) {
    await prisma.reviewRequest.update({
      where: { id: review.id },
      data: { clickedAt: new Date() },
    });
  }

  return NextResponse.redirect(GOOGLE_REVIEW_URL);
}
