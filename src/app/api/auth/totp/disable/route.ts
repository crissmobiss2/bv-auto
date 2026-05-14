import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/totp";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { code, password } = await req.json();
  if (!code || !password) return apiError("code and password are required", 400);

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { totpSecret: true, totpEnabled: true, passwordHash: true },
  });
  if (!user?.totpEnabled) return apiError("MFA is not enabled", 400);

  const passwordValid = user.passwordHash && await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) return apiError("Invalid password", 401);

  if (!verifyTotpCode(user.totpSecret!, code)) {
    return apiError("Invalid authenticator code", 422);
  }

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { totpEnabled: false, totpSecret: null },
  });

  return apiSuccess({ disabled: true });
}
