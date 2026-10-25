import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  triggerType: z.string().min(1).optional(),
  triggerValue: z.string().nullable().optional(),
  messageTemplate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
}).partial();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "DISPATCHER"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: parsed.data,
  });

  return apiSuccess(campaign);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["ADMIN", "DISPATCHER"]);
  if (error) return error;

  const { id } = await params;
  await prisma.marketingCampaign.delete({ where: { id } });
  return apiSuccess({ ok: true });
}
