import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";

export async function GET() {
  const { error, session } = await requireRole(["CUSTOMER"]);
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { customerId: true, name: true, email: true },
  });

  if (!user?.customerId) {
    return NextResponse.json({ error: "No customer record linked to your account" }, { status: 404 });
  }

  const customerId = user.customerId;

  const [customer, vehicles, jobs, invoices, communications, smsMessages] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        createdAt: true,
      },
    }),

    prisma.vehicle.findMany({
      where: { customerId },
      select: {
        id: true,
        year: true,
        make: true,
        model: true,
        trim: true,
        vin: true,
        plate: true,
        color: true,
        mileage: true,
        createdAt: true,
      },
    }),

    prisma.job.findMany({
      where: { customerId },
      include: {
        parts: {
          select: { description: true, partNumber: true, quantity: true, unitCost: true, unitPrice: true },
        },
        jobNotes: {
          where: { isInternal: false },
          select: { content: true, createdAt: true },
        },
        vehicle: { select: { year: true, make: true, model: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.invoice.findMany({
      where: { customerId },
      include: {
        payments: {
          select: { amount: true, method: true, receivedAt: true, reference: true },
        },
        lineItems: { select: { description: true, quantity: true, unitPrice: true, total: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.communication.findMany({
      where: { customerId },
      select: { type: true, direction: true, body: true, subject: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),

    prisma.smsMessage.findMany({
      where: { customerId },
      select: { direction: true, body: true, fromNumber: true, toNumber: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  await logAudit(session!.user.id, AuditAction.EXPORT, "Customer", customerId, null, null, "CCPA data export");

  const payload = {
    exportedAt: new Date().toISOString(),
    requestedBy: user.email,
    customer,
    vehicles,
    jobs,
    invoices,
    communications,
    smsMessages,
  };

  const json = JSON.stringify(payload, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="bvauto-my-data.json"`,
    },
  });
}
