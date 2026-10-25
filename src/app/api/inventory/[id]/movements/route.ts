import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const movements = await prisma.inventoryMovement.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return apiSuccess(movements);
}
