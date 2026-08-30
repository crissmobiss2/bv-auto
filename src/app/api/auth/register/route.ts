import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).max(100),
  role: z.enum(["CUSTOMER", "TECHNICIAN", "SERVICE_ADVISOR", "PARTS_COORDINATOR", "DISPATCHER"]).default("CUSTOMER"),
  inviteCode: z.string().optional(),
});

// Staff roles require an invite code matching STAFF_INVITE_CODE env var
const STAFF_ROLES = ["TECHNICIAN", "SERVICE_ADVISOR", "PARTS_COORDINATOR", "DISPATCHER"];

export async function POST(req: NextRequest) {
  // Throttle: 5 registrations per 10 min per IP (anti-abuse / enumeration).
  if (!rateLimit(`register:${getIP(req)}`, 5, 10 * 60_000)) {
    return apiError("Too many attempts. Please try again later.", 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid registration data", 400);

  const { name, phone, password, role, inviteCode } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  if (STAFF_ROLES.includes(role)) {
    const expected = process.env.STAFF_INVITE_CODE;
    if (!expected || inviteCode !== expected) {
      return apiError("Invalid invite code for staff registration", 403);
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return apiError("An account with this email already exists", 409);

  const passwordHash = await bcrypt.hash(password, 12);

  // For customers, always create a FRESH Customer record for the login.
  // SECURITY: never auto-link a self-registration to a shop-created customer by
  // email alone — without email verification that is an account-takeover vector.
  // Staff can merge the duplicate from the customer record once identity is confirmed.
  let customerId: string | undefined;
  if (role === "CUSTOMER") {
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
