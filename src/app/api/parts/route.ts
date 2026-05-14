import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { z } from "zod";
import { AuditAction, PartStatus } from "@prisma/client";

const createSchema = z.object({
  jobId: z.string(),
  vendorId: z.string().optional(),
  partNumber: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitCost: z.number().optional(),
  unitPrice: z.number().optional(),
  markup: z.number().optional(),
  poNumber: z.string().optional(),
  coreReturn: z.boolean().optional(),
  coreCharge: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;

  const parts = await prisma.jobPart.findMany({
    where,
    include: {
      vendor: true,
      job: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          vehicle: { select: { id: true, year: true, make: true, model: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(parts);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const data = parsed.data;
  const unitCost = data.unitCost ?? 0;
  const markup = data.markup ?? 0;
  const unitPrice = data.unitPrice ?? (unitCost * (1 + markup / 100));
  const totalCost = unitCost * data.quantity;
  const totalPrice = unitPrice * data.quantity;

  const part = await prisma.jobPart.create({
    data: {
      ...data,
      unitPrice,
      totalCost,
      totalPrice,
    },
    include: { vendor: true },
  });

  await logAudit(session!.user.id, AuditAction.CREATE, "JobPart", part.id, null, part);

  return apiSuccess(part, 201);
}
