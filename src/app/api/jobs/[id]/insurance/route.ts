import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const claim = await prisma.insuranceClaim.findUnique({ where: { jobId: id } });
  const sublets = await prisma.sublet.findMany({ where: { jobId: id }, orderBy: { createdAt: "asc" } });
  return apiSuccess({ claim, sublets });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  if (body.type === "insurance") {
    const existing = await prisma.insuranceClaim.findUnique({ where: { jobId: id } });
    if (existing) {
      const claim = await prisma.insuranceClaim.update({
        where: { jobId: id },
        data: {
          claimNumber: body.claimNumber,
          insuranceCompany: body.insuranceCompany,
          adjusterName: body.adjusterName,
          adjusterPhone: body.adjusterPhone,
          adjusterEmail: body.adjusterEmail,
          deductible: body.deductible ? Number(body.deductible) : undefined,
          approvedAmount: body.approvedAmount ? Number(body.approvedAmount) : undefined,
          status: body.status,
          notes: body.notes,
          submittedAt: body.status === "SUBMITTED" && !existing.submittedAt ? new Date() : undefined,
          approvedAt: body.status === "APPROVED" && !existing.approvedAt ? new Date() : undefined,
        },
      });
      return apiSuccess(claim);
    }
    const claim = await prisma.insuranceClaim.create({
      data: {
        jobId: id,
        claimNumber: body.claimNumber,
        insuranceCompany: body.insuranceCompany || "Unknown",
        adjusterName: body.adjusterName,
        adjusterPhone: body.adjusterPhone,
        adjusterEmail: body.adjusterEmail,
        deductible: body.deductible ? Number(body.deductible) : 0,
        notes: body.notes,
      },
    });
    return apiSuccess(claim, 201);
  }

  if (body.type === "sublet") {
    if (!body.vendorName || !body.description) return apiError("vendorName and description required");
    const ourCost = Number(body.ourCost || 0);
    const markup = Number(body.markup || 25);
    const ourCharge = body.ourCharge ? Number(body.ourCharge) : Math.round(ourCost * (1 + markup / 100) * 100) / 100;
    const sublet = await prisma.sublet.create({
      data: { jobId: id, vendorName: body.vendorName, description: body.description, vendorInvoice: body.vendorInvoice, ourCost, ourCharge, markup, notes: body.notes },
    });
    return apiSuccess(sublet, 201);
  }

  return apiError("type must be 'insurance' or 'sublet'");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  if (body.subletId) {
    const sublet = await prisma.sublet.update({
      where: { id: body.subletId },
      data: { status: body.status, completedAt: body.status === "COMPLETE" ? new Date() : undefined, ourCost: body.ourCost ? Number(body.ourCost) : undefined, ourCharge: body.ourCharge ? Number(body.ourCharge) : undefined },
    });
    return apiSuccess(sublet);
  }

  const claim = await prisma.insuranceClaim.update({
    where: { jobId: id },
    data: {
      status: body.status,
      paidAmount: body.paidAmount ? Number(body.paidAmount) : undefined,
      paidAt: body.status === "PAID" ? new Date() : undefined,
      notes: body.notes,
    },
  });
  return apiSuccess(claim);
}
