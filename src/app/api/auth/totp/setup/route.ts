import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret } from "@/lib/totp";
import QRCode from "qrcode";

export async function POST() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { email: true, totpEnabled: true },
  });
  if (!user) return apiError("User not found", 404);
  if (user.totpEnabled) return apiError("MFA is already enabled", 409);

  const { secret, uri } = generateTotpSecret(user.email);

  // Save secret (not yet enabled — only enabled after verification)
  await prisma.user.update({
    where: { id: session!.user.id },
    data: { totpSecret: secret },
  });

  const qrDataUrl = await QRCode.toDataURL(uri);
  return apiSuccess({ secret, qrDataUrl });
}
