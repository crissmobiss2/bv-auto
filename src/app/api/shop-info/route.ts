import { NextResponse } from "next/server";
import { getBranding } from "@/lib/shop";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { resolvePublicShop } from "@/lib/public-shop";
import { enterShop } from "@/lib/tenant";

// Public shop contact info for booking/portal pages (name, phone, email, logo).
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`shopinfo:${getIP(req)}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const slug = req.nextUrl.searchParams.get("shop");
  const shop = await resolvePublicShop(slug);
  if (slug && !shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  if (shop) enterShop(shop.id);
  const { name, phone, email, logoUrl } = await getBranding();
  return NextResponse.json({ name, phone, email, logoUrl });
}
