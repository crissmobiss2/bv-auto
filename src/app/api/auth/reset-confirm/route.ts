import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { hashResetToken, passwordSchema } from "@/lib/password";

const schema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const { token, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { resetToken: hashResetToken(token) },
    select: { id: true, resetTokenExpiry: true, isActive: true },
  });

  if (!user || !user.isActive) return apiError("Invalid or expired reset link", 400);
  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return apiError("Reset link has expired. Please request a new one.", 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Claim the token in the same write, so two simultaneous confirmations can't both succeed.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, resetToken: hashResetToken(token) },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null, passwordChangedAt: new Date() },
  });
  if (count === 0) return apiError("Invalid or expired reset link", 400);
  await prisma.session.deleteMany({ where: { userId: user.id } });

  return apiSuccess({ reset: true });
}
