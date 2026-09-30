import { NextResponse } from "next/server";
import { getDefaultShop } from "@/lib/shop";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

// Public shop contact info for booking/portal pages (name + phone only).
export async function GET(req: NextRequest) {
  if (!rateLimit(`shopinfo:${getIP(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const shop = await getDefaultShop().catch(() => null);
  return NextResponse.json({
    name: shop?.name || "B&V Mobile Auto",
    phone: shop?.phone || null,
    email: shop?.email || null,
  });
}
