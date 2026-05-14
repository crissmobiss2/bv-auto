import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // 3 resets per 15 min per IP — prevents enumeration
  if (!rateLimit(`reset:${getIP(req)}`, 3, 15 * 60_000)) {
    return apiError("Too many requests. Please wait before trying again.", 429);
  }

  const { email } = await req.json();
  if (!email?.trim()) return apiError("Email is required", 400);

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, isActive: true },
  });

  // Always return success — don't reveal if email exists
  if (!user || !user.isActive) {
    return apiSuccess({ sent: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";
  const resetUrl = `${BASE_URL}/reset/${token}`;

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@bvmobileauto.com";
    await resend.emails.send({
      from: `B&V Mobile Auto <${fromEmail}>`,
      to: email,
      subject: "Reset your B&V Auto password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1e293b">Password Reset</h2>
          <p>Hi ${user.name},</p>
          <p>We received a request to reset your B&V Auto password. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;font-weight:600">
            Reset Password
          </a>
          <p style="color:#64748b;font-size:13px">This link expires in 1 hour. If you didn't request a reset, ignore this email — your password won't change.</p>
          <p style="color:#94a3b8;font-size:12px">B&V Mobile Auto — Business Operating System</p>
        </div>`,
    }).catch(console.error);
  }

  return apiSuccess({ sent: true });
}
