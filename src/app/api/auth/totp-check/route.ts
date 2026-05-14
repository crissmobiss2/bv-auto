import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Public — only reveals whether TOTP is enabled, not whether email exists
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) return Response.json({ totpEnabled: false });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { totpEnabled: true },
  });

  return Response.json({ totpEnabled: user?.totpEnabled ?? false });
}
