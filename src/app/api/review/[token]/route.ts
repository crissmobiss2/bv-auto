import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  // Prefer the shop's configured Google review URL. The old hard-coded
  // "https://g.page/r/review" placeholder sends customers to a dead page.
  const shop = await prisma.shop.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { googleReviewUrl: true },
  });
  const target = process.env.GOOGLE_REVIEW_URL || shop?.googleReviewUrl;

  if (!target) {
    return new NextResponse(
      "Online reviews are not configured yet. Please call the shop and we'll help you leave feedback.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  try {
    const url = new URL(target);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid protocol");
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse("The review link is misconfigured. Please call the shop.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
