import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { customerName } from "@/lib/customer-name";
import { formatCurrency, formatDate, lineItemSalePrice } from "@/lib/utils";

export type InvoicePdfBrand = {
  name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
};

export type InvoicePdfInvoice = {
  invoiceNumber: string;
  status: string;
  createdAt: Date;
  dueDate?: Date | null;
  notes?: string | null;
  subtotal: unknown;
  taxRate: unknown;
  taxAmount: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
  amountPaid: unknown;
  amountDue: unknown;
  customer: {
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  job: {
    mileageIn?: number | null;
    mileageOut?: number | null;
    vehicle: {
      year: number;
      make: string;
      model: string;
      vin?: string | null;
      mileage?: number | null;
    };
  };
  lineItems: {
    type: string;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    markup?: unknown;
    total: unknown;
  }[];
  payments: {
    method: string;
    amount: unknown;
    receivedAt: Date;
    reference?: string | null;
  }[];
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  shopName: { fontSize: 18, fontWeight: "bold", color: "#1d4ed8", marginBottom: 3 },
  muted: { color: "#6b7280", fontSize: 8.5, lineHeight: 1.35 },
  invoiceTitle: { fontSize: 17, fontWeight: "bold", textAlign: "right" },
  invoiceNumber: { fontSize: 10, color: "#6b7280", textAlign: "right", marginTop: 2 },
  status: { fontSize: 8, fontWeight: "bold", color: "#166534", textAlign: "right", marginTop: 3 },
  section: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  block: { width: "48%" },
  label: { fontSize: 7.5, fontWeight: "bold", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  strong: { fontWeight: "bold", fontSize: 10, marginBottom: 2 },
  table: { marginTop: 4, marginBottom: 14 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderText: { fontSize: 7.5, fontWeight: "bold", color: "#4b5563", textTransform: "uppercase" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 5, paddingHorizontal: 4 },
  cellDescription: { width: "46%" },
  cellType: { width: "14%", color: "#9ca3af", fontSize: 8 },
  cellQty: { width: "10%", textAlign: "center" },
  cellUnit: { width: "15%", textAlign: "right" },
  cellTotal: { width: "15%", textAlign: "right", fontWeight: "bold" },
  totals: { width: "42%", marginLeft: "auto", marginBottom: 18 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { color: "#4b5563" },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#d1d5db", marginTop: 5, paddingTop: 6, fontSize: 12, fontWeight: "bold" },
  balance: { flexDirection: "row", justifyContent: "space-between", color: "#b45309", fontWeight: "bold", marginTop: 4 },
  paid: { color: "#15803d" },
  notes: { marginTop: 8, padding: 9, backgroundColor: "#f9fafb", fontSize: 8.5, color: "#4b5563" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, textAlign: "center", color: "#9ca3af", fontSize: 8 },
});

function InvoiceDocument({ invoice, brand }: { invoice: InvoicePdfInvoice; brand: InvoicePdfBrand }) {
  const mileage = invoice.job.mileageOut ?? invoice.job.mileageIn ?? invoice.job.vehicle.mileage;
  const customer = customerName(invoice.customer);
  const methodLabel = (method: string) =>
    method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={brand.name}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={{ width: "62%" }}>
            <Text style={styles.shopName}>{brand.name}</Text>
            {brand.location ? <Text style={styles.muted}>{brand.location}</Text> : null}
            {brand.phone ? <Text style={styles.muted}>Phone: {brand.phone}</Text> : null}
            {brand.email ? <Text style={styles.muted}>{brand.email}</Text> : null}
          </View>
          <View style={{ width: "38%" }}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <Text style={styles.status}>{invoice.status}</Text>
            <Text style={styles.muted}>Date: {formatDate(invoice.createdAt)}</Text>
            {invoice.dueDate ? <Text style={styles.muted}>Due: {formatDate(invoice.dueDate)}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.block}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.strong}>{customer}</Text>
            {invoice.customer.company ? <Text style={styles.muted}>{invoice.customer.company}</Text> : null}
            {invoice.customer.phone ? <Text style={styles.muted}>{invoice.customer.phone}</Text> : null}
            {invoice.customer.email ? <Text style={styles.muted}>{invoice.customer.email}</Text> : null}
            {invoice.customer.address ? (
              <Text style={styles.muted}>
                {invoice.customer.address}
                {invoice.customer.city ? `, ${invoice.customer.city}` : ""}
                {invoice.customer.state ? `, ${invoice.customer.state}` : ""}
                {invoice.customer.zip ? ` ${invoice.customer.zip}` : ""}
              </Text>
            ) : null}
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Vehicle</Text>
            <Text style={styles.strong}>
              {invoice.job.vehicle.year} {invoice.job.vehicle.make} {invoice.job.vehicle.model}
            </Text>
            {invoice.job.vehicle.vin ? <Text style={styles.muted}>VIN: {invoice.job.vehicle.vin}</Text> : null}
            {mileage != null && Number(mileage) > 0 ? (
              <Text style={styles.muted}>Mileage: {Number(mileage).toLocaleString()} mi</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.cellDescription]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.cellType]}>Type</Text>
            <Text style={[styles.tableHeaderText, styles.cellQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.cellUnit]}>Unit</Text>
            <Text style={[styles.tableHeaderText, styles.cellTotal]}>Total</Text>
          </View>
          {invoice.lineItems.map((line, index) => (
            <View key={index} style={styles.row} wrap={false}>
              <Text style={styles.cellDescription}>{line.description}</Text>
              <Text style={styles.cellType}>{line.type}</Text>
              <Text style={styles.cellQty}>{String(line.quantity)}</Text>
              <Text style={styles.cellUnit}>
                {formatCurrency(lineItemSalePrice(Number(line.unitPrice), Number(line.markup ?? 0)))}
              </Text>
              <Text style={styles.cellTotal}>{formatCurrency(Number(line.total))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text>{formatCurrency(Number(invoice.subtotal))}</Text>
          </View>
          {Number(invoice.taxAmount) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sales tax (parts only, {Number(invoice.taxRate)}%)</Text>
              <Text>{formatCurrency(Number(invoice.taxAmount))}</Text>
            </View>
          ) : null}
          {Number(invoice.discountAmount) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.paid}>-{formatCurrency(Number(invoice.discountAmount))}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{formatCurrency(Number(invoice.totalAmount))}</Text>
          </View>
          {Number(invoice.amountPaid) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Paid</Text>
              <Text style={styles.paid}>{formatCurrency(Number(invoice.amountPaid))}</Text>
            </View>
          ) : null}
          <View style={styles.balance}>
            <Text>Balance Due</Text>
            <Text>{formatCurrency(Number(invoice.amountDue))}</Text>
          </View>
        </View>

        {invoice.payments.length > 0 ? (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.label}>Payments Received</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: "25%" }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { width: "30%" }]}>Method</Text>
              <Text style={[styles.tableHeaderText, { width: "25%" }]}>Reference</Text>
              <Text style={[styles.tableHeaderText, { width: "20%", textAlign: "right" }]}>Amount</Text>
            </View>
            {invoice.payments.map((payment, index) => (
              <View key={index} style={styles.row} wrap={false}>
                <Text style={{ width: "25%" }}>{formatDate(payment.receivedAt)}</Text>
                <Text style={{ width: "30%" }}>{methodLabel(payment.method)}</Text>
                <Text style={{ width: "25%", color: "#9ca3af" }}>{payment.reference || "—"}</Text>
                <Text style={{ width: "20%", textAlign: "right", color: "#15803d", fontWeight: "bold" }}>
                  {formatCurrency(Number(payment.amount))}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Thank you for choosing {brand.name}!{brand.phone ? ` · For questions call ${brand.phone}` : ""}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: InvoicePdfInvoice, brand: InvoicePdfBrand) {
  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} brand={brand} />);
  return Buffer.from(buffer);
}
