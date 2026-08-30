import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireShop, apiError, apiSuccess } from "@/lib/api-helpers";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  laborHours: z.number().min(0).default(0),
  laborPrice: z.number().min(0).default(0),
  parts: z.array(z.object({
    description: z.string(),
    partNumber: z.string().optional(),
    quantity: z.number().default(1),
    unitPrice: z.number().default(0),
  })).optional(),
  totalPrice: z.number().min(0).default(0),
  sortOrder: z.number().default(0),
});

export async function GET(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const where: Record<string, unknown> = { shopId, isActive: true };
  if (category) where.category = category;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const services = await prisma.cannedService.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const categories = await prisma.cannedService.findMany({
    where: { shopId, isActive: true },
    select: { category: true },
    distinct: ["category"],
  });

  return apiSuccess({
    services,
    categories: categories.map((c) => c.category).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const { error, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues.map((i) => i.message).join(", "), 400);

  const service = await prisma.cannedService.create({ data: { ...parsed.data, shopId } });
  return apiSuccess(service, 201);
}
