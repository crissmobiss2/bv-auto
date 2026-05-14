import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const subscribeSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["web", "android", "ios"]),
});

const unsubscribeSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const { token, platform } = parsed.data;

  await prisma.pushToken.upsert({
    where: { token },
    create: {
      userId: session!.user.id,
      token,
      platform,
    },
    update: {
      userId: session!.user.id,
      platform,
    },
  });

  return apiSuccess({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  await prisma.pushToken.deleteMany({ where: { token: parsed.data.token } });

  return apiSuccess({ ok: true });
}
