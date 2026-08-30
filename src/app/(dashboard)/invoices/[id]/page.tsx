"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Send, DollarSign, Phone, Smartphone, CheckCircle } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate, formatDateTime, formatPhone, INVOICE_STATUS_COLORS } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { useState } from "react";
import { CollectPaymentButton } from "@/components/collect-payment-button";

const PAYMENT_METHODS = ["CASH", "CHECK", "CREDIT_CARD", "DEBIT_CARD", "ZELLE", "VENMO", "CASHAPP", "ACH", "OTHER"];

function PaymentPlanSection({ invoiceId, amountDue }: { invoiceId: string; amountDue: number }) {
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const [numInstallments, setNumInstallments] = useState(3);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: plan } = useQuery({
    queryKey: ["payment-plan", invoiceId],
    queryFn: () => axios.get(`/api/invoices/${invoiceId}/payment-plan`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const each = Math.round((amountDue / numInstallments) * 100) / 100;
      const installments = Array.from({ length: numInstallments }, (_, i) => {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        return { dueDate: d.toISOString().slice(0, 10), amount: i === 0 ? amountDue - each * (numInstallments - 1) : each };
      });
      return axios.post(`/api/invoices/${invoiceId}/payment-plan`, { installments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plan", invoiceId] });
      setShow(false);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ installmentId, paidAmount }: { installmentId: string; paidAmount: number }) =>
      axios.patch(`/api/invoices/${invoiceId}/payment-plan`, { installmentId, paidAmount }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-plan", invoiceId] }),
  });

  if (!show && (!plan || plan.length === 0)) {
    return (
      amountDue > 0 ? (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Payment Plan</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Split balance into monthly installments</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShow(true)}>Set Up Plan</Button>
          </CardContent>
        </Card>
      ) : null
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Payment Plan</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {show && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Number of payments</Label>
                <Select value={String(numInstallments)} onValueChange={(v) => setNumInstallments(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 6].map((n) => <SelectItem key={n} value={String(n)}>{n} payments</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ~{formatCurrency(amountDue / numInstallments)} per month · Total: {formatCurrency(amountDue)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShow(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                Create Plan
              </Button>
            </div>
          </div>
        )}

        {plan?.map((inst: { id: string; dueDate: string; amount: number; status: string; paidAt?: string; paidAmount?: number }) => (
          <div key={inst.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
            <div>
              <p className={inst.status === "PAID" ? "line-through text-gray-400" : "font-medium"}>
                {formatCurrency(inst.amount)} — due {new Date(inst.dueDate).toLocaleDateString()}
              </p>
              {inst.paidAt && <p className="text-xs text-green-600">Paid {new Date(inst.paidAt).toLocaleDateString()}</p>}
            </div>
            {inst.status !== "PAID" && (
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => markPaidMutation.mutate({ installmentId: inst.id, paidAmount: inst.amount })}>
                Mark Paid
              </Button>
            )}
            {inst.status === "PAID" && <span className="text-xs text-green-600 font-medium">✓ Paid</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [textPaySent, setTextPaySent] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "", method: "CASH", reference: "", notes: "",
  });

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => axios.get(`/api/invoices/${id}`).then((r) => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: () => axios.post(`/api/invoices/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Invoice sent", "Customer has been notified via SMS.");
    },
    onError: () => toast.error("Send failed", "Could not send invoice."),
  });

  const textToPayMutation = useMutation({
    mutationFn: () => axios.post(`/api/invoices/${id}/text-to-pay`),
    onSuccess: () => {
      setTextPaySent(true);
      toast.success("Pay link sent", "Text-to-pay link sent to customer.");
    },
    onError: () => toast.error("Failed to send", "Could not send payment link."),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      axios.patch(`/api/invoices/${id}`, {
        action: "payment",
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      setShowPayment(false);
      setPaymentForm({ amount: "", method: "CASH", reference: "", notes: "" });
      toast.success("Payment recorded", `$${paymentForm.amount} payment saved.`);
    },
    onError: () => toast.error("Payment failed", "Could not record payment."),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found.</div>;

  const isPaid = invoice.status === "PAID";
  const isVoid = invoice.status === "VOID";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/invoices"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</h1>
          <span className={`text-xs rounded-md px-2 py-0.5 font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>
            {invoice.status}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> PDF</Button>
          </a>
          {!isPaid && !isVoid && (
            <>
              <Button variant="outline" size="sm" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                <Send className="h-4 w-4 mr-1" /> {sendMutation.isPending ? "Sending..." : "Send"}
              </Button>
              <CollectPaymentButton
                invoiceId={id}
                amountDue={Number(invoice.amountDue)}
                invoiceNumber={invoice.invoiceNumber}
              />
              <Button variant="outline" size="sm"
                onClick={() => textToPayMutation.mutate()}
                disabled={textToPayMutation.isPending || textPaySent}
                className={textPaySent ? "border-green-500 text-green-600" : ""}>
                {textPaySent ? <><CheckCircle className="h-4 w-4 mr-1" /> Sent!</> : <><Smartphone className="h-4 w-4 mr-1" />{textToPayMutation.isPending ? "Sending..." : "Text-to-Pay"}</>}
              </Button>
              <Button size="sm" onClick={() => setShowPayment(true)}>
                <DollarSign className="h-4 w-4 mr-1" /> Record Payment
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Customer Info */}
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-base">
              {invoice.customer.firstName} {invoice.customer.lastName}
            </p>
            {invoice.customer.company && <p className="text-gray-500 dark:text-gray-400">{invoice.customer.company}</p>}
            <a href={`tel:${invoice.customer.phone}`} className="flex items-center gap-1 text-blue-600">
              <Phone className="h-3 w-3" /> {formatPhone(invoice.customer.phone)}
            </a>
            {invoice.customer.address && (
              <p className="text-gray-600 dark:text-gray-400">
                {invoice.customer.address}, {invoice.customer.city}, {invoice.customer.state}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Invoice Meta */}
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Invoice Date</span>
              <span>{formatDate(invoice.createdAt)}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Due Date</span>
                <span className={new Date(invoice.dueDate) < new Date() && !isPaid ? "text-red-600 font-medium" : ""}>
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Vehicle</span>
              <span>{invoice.job.vehicle.year} {invoice.job.vehicle.make} {invoice.job.vehicle.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Job</span>
              <Link href={`/jobs/${invoice.job.id}`} className="text-blue-600 hover:underline">
                {invoice.job.id.slice(0, 8)}...
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader><CardTitle className="text-base">Services & Parts</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invoice.lineItems?.map((li: {
              id: string; type: string; description: string; quantity: number; unitPrice: number; total: number; taxable: boolean;
            }) => (
              <div key={li.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div>
                  <span className="font-medium">{li.description}</span>
                  <span className="text-gray-400 text-xs ml-2">{li.type}</span>
                  {!li.taxable && <span className="text-xs text-gray-400 ml-1">(non-taxable)</span>}
                </div>
                <div className="text-right">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{li.quantity} × {formatCurrency(li.unitPrice)}</p>
                  <p className="font-medium">{formatCurrency(li.total)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 text-sm border-t pt-4">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {Number(invoice.taxAmount) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Tax ({Number(invoice.taxRate)}%)</span><span>{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
              <span>Total</span><span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Paid</span><span>{formatCurrency(invoice.amountPaid)}</span>
              </div>
            )}
            <div className={`flex justify-between font-bold text-lg border-t pt-2 ${Number(invoice.amountDue) > 0 ? "text-orange-600" : "text-green-600"}`}>
              <span>Balance Due</span><span>{formatCurrency(invoice.amountDue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {invoice.payments?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoice.payments.map((p: {
                id: string; amount: number; method: string; reference?: string; receivedAt: string;
              }) => (
                <div key={p.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium">{p.method.replace(/_/g, " ")}</span>
                    {p.reference && <span className="text-gray-400 ml-2">#{p.reference}</span>}
                    <p className="text-xs text-gray-400">{formatDateTime(p.receivedAt)}</p>
                  </div>
                  <span className="text-green-600 font-medium">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Plan */}
      <PaymentPlanSection invoiceId={id} amountDue={Number(invoice.amountDue)} />

      {/* Record Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-md text-sm">
              <p className="text-blue-700">Balance due: <strong>{formatCurrency(invoice.amountDue)}</strong></p>
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder={String(Number(invoice.amountDue))}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference # (optional)</Label>
              <Input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="Check #, transaction ID..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={() => paymentMutation.mutate()} disabled={!paymentForm.amount || paymentMutation.isPending}>
              {paymentMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
