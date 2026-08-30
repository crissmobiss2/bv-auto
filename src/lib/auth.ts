import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { verifyTotpCode } from "@/lib/totp";
import { rateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totpCode: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — shop day; forces re-auth overnight
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        // Brute-force throttle (best-effort, per-instance): 8 attempts / 15 min / email.
        if (!rateLimit(`login:${email}`, 8, 15 * 60_000)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, email: true, name: true, role: true, image: true, shopId: true,
            passwordHash: true, isActive: true, totpEnabled: true, totpSecret: true,
          },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // TOTP check for ADMIN and ACCOUNTANT roles
        if (user.totpEnabled && user.totpSecret) {
          const code = parsed.data.totpCode;
          if (!code) return null; // Login page must supply code when TOTP enabled
          if (!verifyTotpCode(user.totpSecret, code)) return null;
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role, image: user.image, shopId: user.shopId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.shopId = (user as { shopId?: string | null }).shopId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.shopId = (token.shopId as string | null) ?? null;
      }
      return session;
    },
  },
});
