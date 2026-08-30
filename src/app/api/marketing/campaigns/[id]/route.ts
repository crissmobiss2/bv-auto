import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError, pick } from "@/lib/api-helpers";

const MARKETING_ROLES = ["ADMIN", "DISPATCHER"] as const;
const CAMPAIGN_FIELDS = [
  "name", "type", "triggerType", "triggerValue", "messageTemplate", "isActive",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop(MARKETING_ROLES);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Campaign not found", 404);

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: pick(body, CAMPAIGN_FIELDS),
  });

  return apiSuccess(campaign);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, shopId } = await requireShop(MARKETING_ROLES);
  if (error) return error;

  const { id } = await params;
  const existing = await prisma.marketingCampaign.findFirst({ where: { id, shopId } });
  if (!existing) return apiError("Campaign not found", 404);
  await prisma.marketingCampaign.delete({ where: { id } });
  return apiSuccess({ ok: true });
}
