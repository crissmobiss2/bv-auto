import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { getIP, rateLimit } from "@/lib/rate-limit";
import { uniqueShopSlug } from "@/lib/public-shop";

const schema = z.object({
  shopName: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(8).max(100),
  acceptTerms: z.literal(true),
});

// Public: a new repair shop creates its own shop and first admin account.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`signup:${getIP(req)}`, 5, 60 * 60_000))) {
    return apiError("Too many sign-ups from this network. Try again later.", 429);
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Please fill in every field and accept the terms.", 400);
  const { shopName, name, email, phone, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return apiError("An account with this email already exists. Sign in instead.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const slug = await uniqueShopSlug(shopName);
  try {
    const shop = await prisma.$transaction(async (tx) => {
      const created = await tx.shop.create({
        data: { name: shopName, slug, phone: phone || null, email, isDefault: true },
        select: { id: true, slug: true },
      });
      await tx.user.create({
        data: { name, email, passwordHash, role: "ADMIN", isActive: true, phone: phone || null, shopId: created.id },
      });
      return created;
    });
    return apiSuccess({ slug: shop.slug }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return apiError("That email or shop link was just taken. Please try again.", 409);
    }
    throw e;
  }
}
