import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const { token, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { resetToken: token },
    select: { id: true, resetTokenExpiry: true, isActive: true },
  });

  if (!user || !user.isActive) return apiError("Invalid or expired reset link", 400);
  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return apiError("Reset link has expired. Please request a new one.", 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
      // Invalidate all existing sessions on password change
      sessions: { deleteMany: {} },
    },
  });

  return apiSuccess({ reset: true });
}
