import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function temporaryPassword(length = 14) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/**
 * Admin fallback for shops without outbound email: set a one-time temporary
 * password and return it once to the admin. PasswordChangedAt invalidates every
 * existing session on the next Auth.js check.
 */
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!target) return apiError("User not found", 404);
  if (!target.isActive) return apiError("Reactivate this member before resetting their password", 400);

  const tempPassword = temporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);

  await logAudit(session!.user.id, AuditAction.UPDATE, "User", id, null, {
    passwordReset: true,
    targetEmail: target.email,
  }, "Temporary password issued by an admin");

  return apiSuccess({ email: target.email, name: target.name, tempPassword });
}
