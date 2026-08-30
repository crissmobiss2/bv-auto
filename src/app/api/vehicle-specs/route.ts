import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year");
  const make  = searchParams.get("make");
  const model = searchParams.get("model");
  const trim  = searchParams.get("trim");

  // List distinct makes
  if (!make) {
    const makes = await prisma.vehicleSpec.findMany({
      select: { make: true },
      distinct: ["make"],
      orderBy: { make: "asc" },
    });
    return NextResponse.json(makes.map(m => m.make));
  }

  // List models for a make
  if (make && !model) {
    const models = await prisma.vehicleSpec.findMany({
      where: { make: { equals: make, mode: "insensitive" } },
      select: { model: true },
      distinct: ["model"],
      orderBy: { model: "asc" },
    });
    return NextResponse.json(models.map(m => m.model));
  }

  // List years for make+model
  if (make && model && !year) {
    const years = await prisma.vehicleSpec.findMany({
      where: {
        make: { equals: make, mode: "insensitive" },
        model: { equals: model, mode: "insensitive" },
      },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });
    return NextResponse.json(years.map(y => y.year));
  }

  // Get full spec
  if (year && make && model) {
    const spec = await prisma.vehicleSpec.findFirst({
      where: {
        year: parseInt(year),
        make: { equals: make, mode: "insensitive" },
        model: { equals: model, mode: "insensitive" },
        ...(trim ? { trim: { equals: trim, mode: "insensitive" } } : {}),
      },
      orderBy: { trim: "asc" },
    });
    if (!spec) return NextResponse.json({ error: "Spec not found" }, { status: 404 });
    return NextResponse.json(spec);
  }

  return NextResponse.json({ error: "Provide make, model, and year" }, { status: 400 });
}
