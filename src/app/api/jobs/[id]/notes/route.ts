import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const job = await prisma.job.findFirst({ where: { id, shopId } });
  if (!job) return apiError("Job not found", 404);

  const note = await prisma.note.create({
    data: {
      jobId: id,
      authorId: session!.user.id,
      content: parsed.data.content,
      isInternal: parsed.data.isInternal,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  return apiSuccess(note, 201);
}
