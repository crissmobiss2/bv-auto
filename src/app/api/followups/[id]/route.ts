import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.followUp.findFirst({ where: { id, customer: { shopId } } });
  if (!existing) return apiError("Follow-up not found", 404);

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.dueAt !== undefined) updateData.dueAt = new Date(body.dueAt);
  if (body.isCompleted !== undefined) {
    updateData.isCompleted = body.isCompleted;
    updateData.completedAt = body.isCompleted ? new Date() : null;
  }

  const updated = await prisma.followUp.update({ where: { id }, data: updateData });
  return apiSuccess(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.followUp.findFirst({ where: { id, customer: { shopId } } });
  if (!existing) return apiError("Follow-up not found", 404);

  await prisma.followUp.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
