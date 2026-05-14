import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const quote = await prisma.quote.findUnique({
    where: { approvalToken: token },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      job: { include: { vehicle: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) return apiError("Quote not found or link has expired", 404);
  if (quote.status === "CONVERTED" || quote.status === "EXPIRED") {
    return apiError("This quote link is no longer active", 410);
  }

  if (quote.status === "SENT") {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "VIEWED", viewedAt: new Date() } });
  }

  return apiSuccess(quote);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  const { action, declineReason, signerName } = body;

  if (!["approve", "decline"].includes(action)) return apiError("Invalid action");

  const quote = await prisma.quote.findUnique({
    where: { approvalToken: token },
    include: { job: true },
  });

  if (!quote) return apiError("Quote not found", 404);
  if (["APPROVED", "DECLINED", "CONVERTED"].includes(quote.status)) {
    return apiError("This quote has already been responded to");
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";

  if (action === "approve") {
    await prisma.$transaction([
      prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvalMethod: "CUSTOMER_PORTAL",
          approvedBy: signerName || "Customer",
        },
      }),
      prisma.job.update({
        where: { id: quote.jobId },
        data: { status: "APPROVED" },
      }),
      ...(signerName
        ? [
            prisma.signature.create({
              data: {
                jobId: quote.jobId,
                signerName,
                signerRole: "Customer",
                imageData: "portal-approval",
                ipAddress: ip,
              },
            }),
          ]
        : []),
    ]);
    return apiSuccess({ approved: true });
  } else {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "DECLINED", declinedAt: new Date(), declineReason },
    });
    return apiSuccess({ declined: true });
  }
}
