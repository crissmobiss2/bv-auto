import { InvoiceStatus, JobStatus, Prisma } from "@prisma/client";

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002";
}

/**
 * Recompute an invoice's paid/due totals and status from its Payment rows.
 * Refunds are negative rows, so amountPaid is always the net collected.
 * Call inside a transaction after any payment, deposit, or refund write.
 */
export async function reconcileInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { id: true, totalAmount: true, status: true, jobId: true, paidAt: true },
  });
  const payments = await tx.payment.findMany({
    where: { invoiceId },
    select: { amount: true, type: true },
  });

  const totalPaid = roundMoney(payments.reduce((s, p) => s + Number(p.amount), 0));
  const hasRefund = payments.some((p) => p.type === "REFUND");
  const total = roundMoney(Number(invoice.totalAmount));
  const amountDue = Math.max(0, roundMoney(total - totalPaid));

  let status: InvoiceStatus = invoice.status;
  if (status !== InvoiceStatus.VOID) {
    if (totalPaid <= 0 && hasRefund) status = InvoiceStatus.REFUNDED;
    else if (total > 0 && amountDue <= 0) status = InvoiceStatus.PAID;
    else if (totalPaid > 0) status = InvoiceStatus.PARTIAL;
    else if (status === InvoiceStatus.PAID || status === InvoiceStatus.PARTIAL || status === InvoiceStatus.REFUNDED) {
      status = InvoiceStatus.SENT;
    }
  }

  const updated = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: totalPaid,
      amountDue,
      status,
      paidAt: status === InvoiceStatus.PAID ? (invoice.paidAt ?? new Date()) : null,
    },
  });

  if (status === InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PAID) {
    await tx.job.update({ where: { id: invoice.jobId }, data: { status: JobStatus.PAID } });
  } else if (invoice.status === InvoiceStatus.PAID && status !== InvoiceStatus.PAID) {
    await tx.job.updateMany({
      where: { id: invoice.jobId, status: JobStatus.PAID },
      data: { status: JobStatus.INVOICED },
    });
  }

  return { invoice: updated, totalPaid, amountDue, status };
}

/** Lock the invoice row so concurrent payment writers serialize on it. */
export async function lockInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
}
