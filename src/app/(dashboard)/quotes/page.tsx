"use client";

import { Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Plus, Send, CheckCircle, XCircle, FileText, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

const QUOTE_STATUSES = ["ALL", "DRAFT", "SENT", "VIEWED", "APPROVED", "DECLINED", "EXPIRED"];

const QUOTE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-orange-100 text-orange-700",
};

type Quote = {
  id: string;
  quoteNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  validUntil?: string;
  customer: { firstName: string; lastName: string };
  job: { id: string; jobNumber: string; vehicle: { year: number; make: string; model: string } };
};

function QuotesContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const [sending, setSending] = useState<string | null>(null);
  const [approveDialog, setApproveDialog] = useState<Quote | null>(null);
  const [declineDialog, setDeclineDialog] = useState<Quote | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: () =>
      axios.get(`/api/quotes${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`).then(r => r.data),
  });

  const quotes: Quote[] = data?.quotes || [];

  const sendMutation = useMutation({
    mutationFn: (id: string) => axios.post(`/api/quotes/${id}/send`),
    onSuccess: (res, id) => {
      setSending(null);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      if (res.data.approvalUrl) {
        navigator.clipboard?.writeText(res.data.approvalUrl).catch(() => null);
        alert(`Sent! Approval link copied to clipboard:\n${res.data.approvalUrl}`);
      }
    },
    onError: () => setSending(null),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/quotes/${id}`, { status: "APPROVED", approvedBy: "Customer", approvalMethod: "verbal" }),
    onSuccess: () => {
      setApproveDialog(null);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/quotes/${id}`, { status: "DECLINED" }),
    onSuccess: () => {
      setDeclineDialog(null);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: (jobId: string) => axios.post("/api/invoices", { jobId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      alert("Invoice created! Go to Invoices to view it.");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e?.response?.data?.error || "Failed to create invoice");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500">{data?.total || 0} total</p>
        </div>
        <Link href="/jobs/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-1" /> New Quote
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUOTE_STATUSES.filter(s => s !== "ALL").map(s => {
            const count = quotes.filter(q => q.status === s).length;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`p-2 rounded-lg border text-center transition-colors ${statusFilter === s ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-gray-500">{s}</p>
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
              {QUOTE_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileText className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-gray-500">No quotes found.</p>
              <Link href="/jobs/new">
                <Button variant="outline"><Plus className="h-4 w-4 mr-1" /> Create a Job to Generate a Quote</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="hidden sm:table-cell">Total</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="hidden lg:table-cell">Valid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quoteNumber}</TableCell>
                    <TableCell className="text-sm">{q.customer.firstName} {q.customer.lastName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">
                      {q.job.vehicle.year} {q.job.vehicle.make} {q.job.vehicle.model}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-medium">{formatCurrency(q.totalAmount)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-500">{formatDate(q.createdAt)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {q.validUntil ? (
                        <span className={new Date(q.validUntil) < new Date() ? "text-red-600" : "text-gray-500"}>
                          {formatDate(q.validUntil)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${QUOTE_STATUS_COLORS[q.status] || "bg-gray-100 text-gray-700"}`}>
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/jobs/${q.job.id}`}>
                          <Button variant="ghost" size="icon" title="View Job">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {(q.status === "DRAFT" || q.status === "SENT") && (
                          <Button variant="ghost" size="icon" title="Send to Customer"
                            onClick={() => { setSending(q.id); sendMutation.mutate(q.id); }}
                            disabled={sending === q.id}>
                            {sending === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-blue-500" />}
                          </Button>
                        )}
                        {(q.status === "SENT" || q.status === "VIEWED" || q.status === "DRAFT") && (
                          <>
                            <Button variant="ghost" size="icon" title="Mark Approved"
                              onClick={() => setApproveDialog(q)}>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Mark Declined"
                              onClick={() => setDeclineDialog(q)}>
                              <XCircle className="h-4 w-4 text-red-400" />
                            </Button>
                          </>
                        )}
                        {q.status === "APPROVED" && (
                          <Button variant="ghost" size="icon" title="Create Invoice"
                            onClick={() => convertMutation.mutate(q.job.id)}
                            disabled={convertMutation.isPending}>
                            <FileText className="h-4 w-4 text-purple-500" />
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

      {/* Approve confirm */}
      <Dialog open={!!approveDialog} onOpenChange={o => !o && setApproveDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Approve Quote</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Mark <strong>{approveDialog?.quoteNumber}</strong> as approved by the customer?
            This will set the job status to APPROVED.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700"
              onClick={() => approveDialog && approveMutation.mutate(approveDialog.id)}
              disabled={approveMutation.isPending}>
              {approveMutation.isPending ? "Saving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline confirm */}
      <Dialog open={!!declineDialog} onOpenChange={o => !o && setDeclineDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Decline Quote</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Mark <strong>{declineDialog?.quoteNumber}</strong> as declined?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialog(null)}>Cancel</Button>
            <Button variant="destructive"
              onClick={() => declineDialog && declineMutation.mutate(declineDialog.id)}
              disabled={declineMutation.isPending}>
              {declineMutation.isPending ? "Saving..." : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
      <QuotesContent />
    </Suspense>
  );
}
