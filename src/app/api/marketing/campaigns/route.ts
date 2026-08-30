import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiSuccess, apiError } from "@/lib/api-helpers";

export async function GET() {
  const { error, shopId } = await requireShop(["ADMIN", "DISPATCHER"]);
  if (error) return error;

  const campaigns = await prisma.marketingCampaign.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(campaigns);
}

export async function POST(req: NextRequest) {
  const { error, shopId } = await requireShop(["ADMIN", "DISPATCHER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.name || !body.type || !body.triggerType || !body.messageTemplate) {
    return apiError("name, type, triggerType, and messageTemplate are required");
  }

  const campaign = await prisma.marketingCampaign.create({
    data: {
      shopId,
      name: body.name,
      type: body.type,
      triggerType: body.triggerType,
      triggerValue: body.triggerValue,
      messageTemplate: body.messageTemplate,
      isActive: body.isActive ?? true,
    },
  });

  return apiSuccess(campaign, 201);
}
