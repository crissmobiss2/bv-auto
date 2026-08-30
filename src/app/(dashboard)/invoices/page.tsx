"use client";

import { Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Download, DollarSign, Send, Plus, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

const PAYMENT_METHODS = ["CASH", "CHECK", "CREDIT_CARD", "DEBIT_CARD", "VENMO", "ZELLE", "ACH", "OTHER"];

type Invoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  amountDue: number;
  status: string;
  createdAt: string;
  dueDate?: string;
  customer: { id: string; firstName: string; lastName: string; phone: string };
  job: { id: string; jobNumber: string; vehicle: { year: number; make: string; model: string } };
};

function InvoicesContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const [payDialog, setPayDialog] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", reference: "", notes: "" });
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      axios.get(`/api/invoices${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`).then(r => r.data),
  });

  const invoices: Invoice[] = data?.invoices || [];

  const totalDue = invoices
    .filter(i => ["SENT", "VIEWED", "PARTIAL", "OVERDUE"].includes(i.status))
    .reduce((s, i) => s + Number(i.amountDue), 0);

  const payMutation = useMutation({
    mutationFn: () => axios.patch(`/api/invoices/${payDialog!.id}`, {
      action: "payment",
      amount: parseFloat(payForm.amount),
      method: payForm.method,
      reference: payForm.reference || undefined,
      notes: payForm.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPayDialog(null);
      setPayForm({ amount: "", method: "CASH", reference: "", notes: "" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => axios.post(`/api/invoices/${id}/send`),
    onSuccess: (res) => {
      setSendingId(null);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (res.data?.paymentUrl) {
        navigator.clipboard?.writeText(res.data.paymentUrl).catch(() => null);
        alert(`Invoice sent! Payment link copied to clipboard:\n${res.data.paymentUrl}`);
      }
    },
    onError: () => setSendingId(null),
  });

  const openPayDialog = (inv: Invoice) => {
    setPayDialog(inv);
    setPayForm({ amount: String(Number(inv.amountDue).toFixed(2)), method: "CASH", reference: "", notes: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data?.total || 0} total ·{" "}
            {totalDue > 0 && <span className="text-orange-600 font-medium">{formatCurrency(totalDue)} outstanding</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/invoices/export" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </a>
          <Link href="/jobs/new">
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      {data && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Outstanding", statuses: ["SENT", "VIEWED", "OVERDUE", "PARTIAL"], color: "text-orange-600" },
            { label: "Paid", statuses: ["PAID"], color: "text-green-600" },
            { label: "Overdue", statuses: ["OVERDUE"], color: "text-red-600" },
            { label: "Draft", statuses: ["DRAFT"], color: "text-gray-600 dark:text-gray-400" },
          ].map(({ label, statuses, color }) => {
            const count = invoices.filter(i => statuses.includes(i.status)).length;
            return (
              <button key={label}
                onClick={() => setStatusFilter(statuses[0] === "SENT" ? "ALL" : statuses[0])}
                className="p-3 rounded-lg border bg-white dark:bg-gray-900 text-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </button>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {["ALL", "DRAFT", "SENT", "VIEWED", "PARTIAL", "PAID", "OVERDUE", "VOID"].map(s => (
                <SelectItem key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileText className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-gray-500 dark:text-gray-400">No invoices found.</p>
              <Link href="/jobs/new">
                <Button variant="outline"><Plus className="h-4 w-4 mr-1" /> Create a Job to Generate an Invoice</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="hidden sm:table-cell">Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Balance Due</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{inv.customer.firstName} {inv.customer.lastName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500 dark:text-gray-400">
                      {inv.job.vehicle.year} {inv.job.vehicle.make} {inv.job.vehicle.model}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-medium">{formatCurrency(inv.totalAmount)}</TableCell>
                    <TableCell className={`hidden sm:table-cell font-medium ${Number(inv.amountDue) > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {formatCurrency(inv.amountDue)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400">{formatDate(inv.createdAt)}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${INVOICE_STATUS_COLORS[inv.status] || "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300"}`}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="icon" title="View Invoice">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="Download PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        {["DRAFT", "SENT", "VIEWED", "OVERDUE"].includes(inv.status) && (
                          <Button variant="ghost" size="icon" title="Send Invoice"
                            onClick={() => { setSendingId(inv.id); sendMutation.mutate(inv.id); }}
                            disabled={sendingId === inv.id}>
                            {sendingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-blue-500" />}
                          </Button>
                        )}
                        {["SENT", "VIEWED", "PARTIAL", "OVERDUE"].includes(inv.status) && (
                          <Button variant="ghost" size="icon" title="Record Payment"
                            onClick={() => openPayDialog(inv)}>
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={o => !o && setPayDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment — {payDialog?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {payDialog.customer.firstName} {payDialog.customer.lastName} ·{" "}
                Balance due: <strong className="text-orange-600">{formatCurrency(payDialog.amountDue)}</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount Received</Label>
                  <Input
                    type="number" step="0.01" min="0.01"
                    value={payForm.amount}
                    onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={payForm.method} onValueChange={v => setPayForm({ ...payForm, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference / Check # (optional)</Label>
                <Input
                  placeholder="Check #, transaction ID..."
                  value={payForm.reference}
                  onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  placeholder="Any notes about this payment"
                  value={payForm.notes}
                  onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                />
              </div>
              {payMutation.isError && (
                <p className="text-sm text-red-600">Failed to record payment. Please try again.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => payMutation.mutate()}
              disabled={!payForm.amount || parseFloat(payForm.amount) <= 0 || payMutation.isPending}
            >
              {payMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : <><DollarSign className="h-4 w-4 mr-2" /> Record Payment</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>}>
      <InvoicesContent />
    </Suspense>
  );
}
