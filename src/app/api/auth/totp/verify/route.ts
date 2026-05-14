import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { code } = await req.json();
  if (!code) return apiError("code is required", 400);

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpSecret) return apiError("MFA setup not started", 400);
  if (user.totpEnabled) return apiError("MFA already enabled", 409);

  if (!verifyTotpCode(user.totpSecret, code)) {
    return apiError("Invalid code. Check your authenticator app.", 422);
  }

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { totpEnabled: true },
  });

  return apiSuccess({ enabled: true });
}
