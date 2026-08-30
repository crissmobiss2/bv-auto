import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireShop } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year");
  const make  = searchParams.get("make");
  const model = searchParams.get("model");
  const code  = searchParams.get("code");

  const where: Record<string, unknown> = {};
  if (year)  where.year  = parseInt(year);
  if (make)  where.make  = { contains: make,  mode: "insensitive" };
  if (model) where.model = { contains: model, mode: "insensitive" };
  if (code)  where.dtcCodes = { has: code.toUpperCase() };

  const failures = await prisma.patternFailure.findMany({
    where,
    orderBy: [{ successCount: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json(failures);
}

export async function POST(req: NextRequest) {
  const { error, session, shopId } = await requireShop();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { year, make, model, engine, dtcCodes, symptoms, confirmedFix, partNumbers, laborHours, notes } = body;

  if (!year || !make || !model || !confirmedFix || !dtcCodes?.length) {
    return NextResponse.json({ error: "year, make, model, dtcCodes, confirmedFix required" }, { status: 400 });
  }

  // Check for existing identical fix — increment successCount instead of duplicate
  const existing = await prisma.patternFailure.findFirst({
    where: {
      year: parseInt(year),
      make: { equals: make, mode: "insensitive" },
      model: { equals: model, mode: "insensitive" },
      confirmedFix: { equals: confirmedFix, mode: "insensitive" },
      dtcCodes: { hasEvery: dtcCodes.map((c: string) => c.toUpperCase()) },
    },
  });

  if (existing) {
    const updated = await prisma.patternFailure.update({
      where: { id: existing.id },
      data: { successCount: { increment: 1 } },
    });
    return NextResponse.json(updated);
  }

  const failure = await prisma.patternFailure.create({
    data: {
      year: parseInt(year),
      make,
      model,
      engine: engine || null,
      dtcCodes: dtcCodes.map((c: string) => c.toUpperCase()),
      symptoms: symptoms || [],
      confirmedFix,
      partNumbers: partNumbers || [],
      laborHours: laborHours ? parseFloat(laborHours) : null,
      notes: notes || null,
      techId: session!.user.id,
      shopId,
    },
  });

  return NextResponse.json(failure, { status: 201 });
}
