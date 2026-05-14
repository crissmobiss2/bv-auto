import twilio from "twilio";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const FROM = process.env.TWILIO_PHONE_NUMBER || "+15550001000";
const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";

async function send(to: string, body: string) {
  const e164 = to.replace(/\D/g, "");
  const phone = e164.length === 10 ? `+1${e164}` : `+${e164}`;

  if (!client) {
    console.log(`[SMS STUB] To: ${phone} | Body: ${body}`);
    return { sid: "stub" };
  }
  return client.messages.create({ from: FROM, to: phone, body });
}

export async function sendQuoteSMS(opts: {
  to: string;
  customerName: string;
  quoteNumber: string;
  totalAmount: string;
  approvalToken: string;
}) {
  const url = `${BASE_URL}/approve/${opts.approvalToken}`;
  return send(
    opts.to,
    `B&V Auto: Hi ${opts.customerName}, your estimate (${opts.quoteNumber}) for ${opts.totalAmount} is ready. Review & approve: ${url}`
  );
}

export async function sendInvoiceSMS(opts: {
  to: string;
  customerName: string;
  invoiceNumber: string;
  amountDue: string;
  paymentUrl?: string;
}) {
  const body = opts.paymentUrl
    ? `B&V Auto: Hi ${opts.customerName}, invoice ${opts.invoiceNumber} — ${opts.amountDue} due. Pay now: ${opts.paymentUrl}`
    : `B&V Auto: Hi ${opts.customerName}, invoice ${opts.invoiceNumber} — ${opts.amountDue} due. Call (555) 000-1000 to pay.`;
  return send(opts.to, body);
}

export async function sendAppointmentReminderSMS(opts: {
  to: string;
  customerName: string;
  jobTitle: string;
  dateTime: string;
  address?: string;
}) {
  const loc = opts.address ? ` at ${opts.address}` : "";
  return send(
    opts.to,
    `B&V Auto reminder: Hi ${opts.customerName}, your ${opts.jobTitle}${loc} is scheduled for ${opts.dateTime}. Reply STOP to opt out.`
  );
}

export async function sendPaymentReceivedSMS(opts: {
  to: string;
  customerName: string;
  amountPaid: string;
}) {
  return send(
    opts.to,
    `B&V Auto: Hi ${opts.customerName}, we received your payment of ${opts.amountPaid}. Thank you!`
  );
}
