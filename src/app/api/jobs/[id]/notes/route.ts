import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true, technicianId: true },
  });
  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only add notes to jobs assigned to you", 403);
  }

  const note = await prisma.note.create({
    data: {
      jobId: id,
      authorId: session!.user.id,
      content: parsed.data.content,
      isInternal: parsed.data.isInternal,
    },
    include: { author: { select: { id: true, name: true } } },
  });
  await logAudit(session!.user.id, AuditAction.CREATE, "Note", note.id, null, { jobId: id, isInternal: note.isInternal, content: note.content });

  return apiSuccess(note, 201);
}
