import { NextResponse } from "next/server";
import { getBranding } from "@/lib/shop";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

// Public shop contact info for booking/portal pages (name, phone, email, logo).
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`shopinfo:${getIP(req)}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { name, phone, email, logoUrl } = await getBranding();
  return NextResponse.json({ name, phone, email, logoUrl });
}
