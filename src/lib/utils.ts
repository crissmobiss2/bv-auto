import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function generateJobNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `JOB-${year}${month}-${random}`;
}

export function generateQuoteNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `QT-${year}${month}-${random}`;
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${year}${month}-${random}`;
}

export function calculateLineItemTotal(
  quantity: number,
  unitPrice: number,
  markup?: number | null,
  discount?: number | null
): number {
  let price = unitPrice;
  if (markup) price = price * (1 + markup / 100);
  let total = price * quantity;
  if (discount) total = total * (1 - discount / 100);
  return Math.round(total * 100) / 100;
}

export function calculateTotals(
  lineItems: { total: number; taxable: boolean; type: string }[],
  taxRate: number,
  additionalDiscount = 0
) {
  const subtotal = lineItems
    .filter((li) => li.type !== "TAX" && li.type !== "DISCOUNT")
    .reduce((sum, li) => sum + li.total, 0);

  const taxableAmount = lineItems
    .filter((li) => li.taxable && li.type !== "TAX" && li.type !== "DISCOUNT")
    .reduce((sum, li) => sum + li.total, 0);

  const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  const discountAmount = Math.round(subtotal * (additionalDiscount / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;

  return { subtotal, taxAmount, discountAmount, total };
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  ESTIMATE: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-orange-100 text-orange-700",
  PARTS_WAITING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  INVOICED: "bg-cyan-100 text-cyan-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
  WARRANTY: "bg-pink-100 text-pink-700",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-indigo-100 text-indigo-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  VOID: "bg-gray-100 text-gray-500",
  REFUNDED: "bg-pink-100 text-pink-700",
};

export const PART_STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-gray-100 text-gray-700",
  QUOTED: "bg-yellow-100 text-yellow-700",
  ORDERED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  PICKED_UP: "bg-purple-100 text-purple-700",
  RECEIVED: "bg-cyan-100 text-cyan-700",
  INSTALLED: "bg-green-100 text-green-700",
  RETURNED: "bg-orange-100 text-orange-700",
  CREDITED: "bg-teal-100 text-teal-700",
  CANCELLED: "bg-red-100 text-red-700",
};
