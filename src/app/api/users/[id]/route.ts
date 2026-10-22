import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess, apiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return apiError(parsed.error.issues[0].message);
  const data = parsed.data;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
  if (!target) return apiError("User not found", 404);

  if (id === session!.user.id && (data.isActive === false || (data.role && data.role !== target.role))) {
    return apiError("You can't deactivate yourself or change your own role", 400);
  }

  const losesAdmin =
    target.role === "ADMIN" && target.isActive &&
    (data.isActive === false || (data.role && data.role !== "ADMIN"));
  if (losesAdmin) {
    const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { not: id } } });
    if (otherAdmins === 0) return apiError("At least one active admin is required", 400);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, phone: true, isActive: true },
  });

  if (data.isActive === false) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  return apiSuccess(user);
}
