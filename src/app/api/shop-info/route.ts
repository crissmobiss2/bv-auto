import { NextResponse } from "next/server";
import { getBranding } from "@/lib/shop";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { resolvePublicShop } from "@/lib/public-shop";
import { enterShop } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Public shop contact info for booking/portal pages (name, phone, email, logo).
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`shopinfo:${getIP(req)}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const slug = req.nextUrl.searchParams.get("shop");
  // Signed-in customers see their own shop; public pages use the ?shop= link.
  // Portal and estimate links carry their token, which names the shop that sent them.
  const portal = req.nextUrl.searchParams.get("portal");
  const quote = req.nextUrl.searchParams.get("quote");
  const own = slug ? null
    : portal ? (await prisma.customer.findFirst({ where: { portalToken: portal }, select: { shopId: true } }))?.shopId
    : quote ? (await prisma.quote.findFirst({ where: { approvalToken: quote }, select: { shopId: true } }))?.shopId
    : (await auth())?.user?.shopId;
  const shop = own ? { id: own } : await resolvePublicShop(slug);
  if (slug && !shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  if (shop) enterShop(shop.id);
  const { name, phone, email, logoUrl } = await getBranding();
  return NextResponse.json({ name, phone, email, logoUrl });
}
