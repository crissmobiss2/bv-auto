"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { FileText, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  SENT: "bg-blue-100 text-blue-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  DRAFT: "bg-gray-100 text-gray-600",
};

export default function CustomerInvoices() {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-dashboard"],
    queryFn: () => axios.get("/api/customer/dashboard").then(r => r.data),
  });

  const invoices = data?.allInvoices || data?.openInvoices || [];
  const openBalance = data?.stats?.openBalance ?? 0;
  const shopPhone: string | undefined = data?.shop?.phone || undefined;
  const telHref = shopPhone ? `tel:${shopPhone.replace(/[^\d+]/g, "")}` : undefined;

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        {openBalance > 0 && (
          <p className="text-sm text-red-600 font-medium mt-0.5">
            Open balance: {formatCurrency(openBalance)}
          </p>
        )}
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
            <p className="font-semibold text-gray-700">All Paid Up!</p>
            <p className="text-sm text-gray-400">No outstanding invoices.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: {
            id: string; invoiceNumber: string; status: string;
            totalAmount: number; amountDue: number; dueDate?: string;
            job?: { title: string; jobNumber: string };
          }) => (
            <Card key={inv.id} className={inv.status === "OVERDUE" ? "border-red-200" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${STATUS_STYLES[inv.status] || "bg-gray-100"}`}>
                      {inv.status === "OVERDUE" ? <AlertTriangle className="h-4 w-4" /> :
                       inv.status === "PAID" ? <CheckCircle className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                      {inv.job && <p className="text-xs text-gray-500">{inv.job.title}</p>}
                      {inv.dueDate && (
                        <p className="text-xs text-gray-400">Due: {formatDateTime(inv.dueDate)}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                    {inv.amountDue < inv.totalAmount && (
                      <p className="text-xs text-red-600">Owes: {formatCurrency(inv.amountDue)}</p>
                    )}
                    <Badge className={`text-xs mt-1 ${STATUS_STYLES[inv.status] || "bg-gray-100 text-gray-600"}`}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
                {["SENT", "OVERDUE", "PARTIAL"].includes(inv.status) && telHref && (
                  <div className="mt-3 pt-3 border-t">
                    <a href={telHref}>
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                        <FileText className="h-3 w-3 mr-1.5" /> Contact Us to Pay
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
