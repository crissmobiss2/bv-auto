import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordSchema } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { countActiveShops, resolvePublicShop } from "@/lib/public-shop";
import { enterShop } from "@/lib/tenant";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  password: passwordSchema,
  role: z.enum(["CUSTOMER", "TECHNICIAN", "SERVICE_ADVISOR", "PARTS_COORDINATOR", "DISPATCHER"]).default("CUSTOMER"),
  inviteCode: z.string().optional(),
  shop: z.string().max(80).optional(),
});

// Staff roles require an invite code matching STAFF_INVITE_CODE env var
const STAFF_ROLES = ["TECHNICIAN", "SERVICE_ADVISOR", "PARTS_COORDINATOR", "DISPATCHER"];

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`register:${getIP(req)}`, 10, 10 * 60_000))) {
    return apiError("Too many requests", 429);
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid registration data", 400);

  const { name, email, phone, password, role, inviteCode, shop: shopSlug } = parsed.data;

  if (STAFF_ROLES.includes(role)) {
    const expected = process.env.STAFF_INVITE_CODE;
    if (!expected || inviteCode !== expected) {
      return apiError("Invalid invite code for staff registration", 403);
    }
    // The invite code is app-wide, so it can't say which shop to join once there are several.
    if ((await countActiveShops()) > 1) {
      return apiError("Ask your shop's admin to add you from the Users page.", 403);
    }
  }

  // Without a shop link there's no way to tell which shop a customer belongs to.
  if (!shopSlug && (await countActiveShops()) > 1) {
    return apiError("Please use the sign-up link from your shop's booking page or invoice.", 400);
  }
  const shop = await resolvePublicShop(shopSlug);
  if (!shop) return apiError("Shop not found", 404);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return apiError("An account with this email already exists", 409);

  const passwordHash = await bcrypt.hash(password, 12);
  enterShop(shop.id);

  // For customers: create a Customer record linked to this account.
  //
  // Never auto-link an existing customer record by email. Email ownership is
  // not verified during registration, so doing that lets anyone register with
  // a victim's email and read that customer's jobs, invoices and messages.
  // Existing customers must be linked by staff (or a future verified-email
  // claim flow) instead.
  let customerId: string | undefined;
  if (role === "CUSTOMER") {
    const existingCustomer = await prisma.customer.findFirst({
      where: { email, isActive: true },
      select: { id: true },
    });

    if (existingCustomer) {
      return apiError(
        "A customer record already exists for this email. Contact the shop to activate online access.",
        409,
      );
    }

    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "-";
    const newCustomer = await prisma.customer.create({
      data: { firstName, lastName, email, phone: phone || "", isActive: true },
    });
    customerId = newCustomer.id;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      isActive: true,
      phone: phone || null,
      customerId: customerId || null,
    },
  });

  return apiSuccess({ id: user.id, email: user.email, role: user.role }, 201);
}
