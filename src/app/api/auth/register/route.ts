import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";

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
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid registration data", 400);

  const { name, email, phone, password, role, inviteCode } = parsed.data;

  if (STAFF_ROLES.includes(role)) {
    const expected = process.env.STAFF_INVITE_CODE;
    if (!expected || inviteCode !== expected) {
      return apiError("Invalid invite code for staff registration", 403);
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return apiError("An account with this email already exists", 409);

  const passwordHash = await bcrypt.hash(password, 12);

  // For customers: find or create a Customer record linked to this account
  let customerId: string | undefined;
  if (role === "CUSTOMER") {
    const existingCustomer = await prisma.customer.findFirst({
      where: { email, isActive: true },
    });

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "-";
      const newCustomer = await prisma.customer.create({
        data: { firstName, lastName, email, phone: phone || "", isActive: true },
      });
      customerId = newCustomer.id;
    }
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
