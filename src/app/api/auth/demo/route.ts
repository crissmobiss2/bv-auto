import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getIP } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const DEMO_EMAIL = "demo@bvauto.com";
const DEMO_PASSWORD = "demo-preview-2024";

export async function POST(req: NextRequest) {
  // SECURITY: never hand out working staff credentials in production.
  // This endpoint seeds a DISPATCHER demo account and must stay non-prod only.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO_LOGIN !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 10 demo logins per 5 min per IP
  if (!rateLimit(`demo:${getIP(req)}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Ensure demo user exists and is always fresh
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash: hash, isActive: true },
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      role: "DISPATCHER",
      passwordHash: hash,
      isActive: true,
    },
  });

  return NextResponse.json({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
}
