import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole).default("TECHNICIAN"),
  phone: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "DISPATCHER", "ACCOUNTANT", "TECHNICIAN", "PARTS_COORDINATOR"]);
  if (error) return error;

  const role = req.nextUrl.searchParams.get("role") as UserRole | null;

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(role ? { role } : {}),
    },
    select: { id: true, name: true, email: true, role: true, phone: true },
    orderBy: { name: "asc" },
  });

  return apiSuccess(users);
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return apiError("A user with that email already exists", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      phone: parsed.data.phone,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return apiSuccess(user, 201);
}
