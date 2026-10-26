import { NextRequest, NextResponse } from "next/server";
import { enterShop } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { looksLikeBot } from "@/lib/audit-redact";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const review = await prisma.reviewRequest.findUnique({
    where: { reviewToken: token },
  });
  if (review?.shopId) enterShop(review.shopId);

  if (review && !review.clickedAt && !looksLikeBot(req.headers.get("user-agent"), req.method)) {
    await prisma.reviewRequest.update({
      where: { id: review.id },
      data: { clickedAt: new Date() },
    });
  }

  const shop = await prisma.shop
    .findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { googleReviewUrl: true },
    })
    .catch(() => null);
  const target = shop?.googleReviewUrl || process.env.GOOGLE_REVIEW_URL;

  if (review && target && /^https:\/\//.test(target)) {
    return NextResponse.redirect(target);
  }
  return NextResponse.redirect(new URL(`/review/${encodeURIComponent(token)}?status=${review ? "thanks" : "invalid"}`, req.url));
}
