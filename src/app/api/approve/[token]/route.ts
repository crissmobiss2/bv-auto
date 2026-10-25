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
  if (quote.validUntil && quote.validUntil < new Date()) {
    // Do not let a late GET overwrite an approval/decline that just won the
    // race. Only non-terminal quotes may be marked expired.
    await prisma.quote.updateMany({
      where: { id: quote.id, status: { notIn: ["APPROVED", "DECLINED", "CONVERTED", "EXPIRED"] } },
      data: { status: "EXPIRED" },
    });
    return apiError("This quote has expired. Please contact the shop for an updated estimate.", 410);
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
  if (typeof signerName === "string" && signerName.length > 120) {
    return apiError("Signer name is too long", 400);
  }
  if (typeof declineReason === "string" && declineReason.length > 2000) {
    return apiError("Decline reason is too long", 400);
  }

  const quote = await prisma.quote.findUnique({
    where: { approvalToken: token },
    include: { job: true },
  });

  if (!quote) return apiError("Quote not found", 404);
  if (["APPROVED", "DECLINED", "CONVERTED"].includes(quote.status)) {
    return apiError("This quote has already been responded to", 409);
  }
  if (quote.validUntil && quote.validUntil < new Date()) {
    await prisma.quote.updateMany({
      where: { id: quote.id, status: { notIn: ["APPROVED", "DECLINED", "CONVERTED", "EXPIRED"] } },
      data: { status: "EXPIRED" },
    });
    return apiError("This quote has expired. Please contact the shop for an updated estimate.", 410);
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const signer = typeof signerName === "string" ? signerName.trim().slice(0, 120) : "";
  const reason = typeof declineReason === "string" ? declineReason.trim().slice(0, 2000) : undefined;

  // Re-check the status inside a serializable transaction so a double-click or
  // two open tabs cannot both approve the quote and create duplicate signatures.
  const outcome = await prisma.$transaction(async (tx) => {
    const current = await tx.quote.findUnique({
      where: { id: quote.id },
      select: { status: true, validUntil: true },
    });
    if (!current || ["APPROVED", "DECLINED", "CONVERTED", "EXPIRED"].includes(current.status)) {
      return "already" as const;
    }
    // Re-check expiry under the same serializable transaction. A quote that
    // expires between the initial check and this transaction must not be
    // approved.
    if (current.validUntil && current.validUntil < new Date()) {
      return "expired" as const;
    }

    if (action === "approve") {
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvalMethod: "CUSTOMER_PORTAL",
          approvedBy: signer || "Customer",
        },
      });
      await tx.job.update({
        where: { id: quote.jobId },
        data: { status: "APPROVED" },
      });
      if (signer) {
        await tx.signature.create({
          data: {
            jobId: quote.jobId,
            signerName: signer,
            signerRole: "Customer",
            imageData: "portal-approval",
            ipAddress: ip,
          },
        });
      }
    } else {
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "DECLINED", declinedAt: new Date(), declineReason: reason },
      });
    }
    return action === "approve" ? ("approved" as const) : ("declined" as const);
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    // A concurrent approval/decline can surface as a serialization failure.
    // Tell the customer to refresh instead of showing an opaque 500.
    if ((error as { code?: string })?.code === "P2034") return "conflict" as const;
    throw error;
  });

  if (outcome === "conflict") {
    return apiError("This quote changed while you were responding. Refresh and try again.", 409);
  }
  if (outcome === "expired") {
    await prisma.quote.updateMany({
      where: { id: quote.id, status: { notIn: ["APPROVED", "DECLINED", "CONVERTED", "EXPIRED"] } },
      data: { status: "EXPIRED" },
    });
    return apiError("This quote has expired. Please contact the shop for an updated estimate.", 410);
  }
  if (outcome === "already") return apiError("This quote has already been responded to", 409);
  return apiSuccess(action === "approve" ? { approved: true } : { declined: true });
}
