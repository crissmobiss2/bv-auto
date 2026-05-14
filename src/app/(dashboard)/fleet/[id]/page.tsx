"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Phone, Mail, MapPin, DollarSign, Wrench, AlertCircle, Printer } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS } from "@/lib/utils";

export default function FleetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: account, isLoading } = useQuery({
    queryKey: ["fleet", id],
    queryFn: () => axios.get(`/api/fleet/${id}`).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => axios.patch(`/api/fleet/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fleet", id] }),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!account) return <div className="p-8 text-center text-red-500">Account not found</div>;

  const unpaidJobs = (account.jobs || []).filter((j: { invoice?: { status: string } }) =>
    j.invoice && ["SENT", "VIEWED", "PARTIAL", "OVERDUE"].includes(j.invoice.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/fleet"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-blue-600" />{account.name}</h1>
          <Badge variant="outline">{account.billingTerms.replace("_", " ")}</Badge>
          {account.poRequired && <Badge className="ml-2 bg-orange-100 text-orange-700">PO Required</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Statement</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(account.totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Open Balance</p>
          <p className={`text-2xl font-bold ${account.openBalance > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(account.openBalance)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Jobs</p>
          <p className="text-2xl font-bold">{account.jobs?.length || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Custom Labor Rate</p>
          <p className="text-2xl font-bold">{account.customLaborRate ? `${formatCurrency(account.customLaborRate)}/hr` : "Standard"}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact info */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Account Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {account.contactName && <p className="font-medium">{account.contactName}</p>}
            {account.phone && <a href={`tel:${account.phone}`} className="flex items-center gap-2 text-blue-600 hover:underline"><Phone className="h-3 w-3" />{account.phone}</a>}
            {account.email && <a href={`mailto:${account.email}`} className="flex items-center gap-2 text-blue-600 hover:underline"><Mail className="h-3 w-3" />{account.email}</a>}
            {account.address && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{account.address}, {account.city}, {account.state} {account.zip}</span>
              </div>
            )}
            {account.creditLimit && (
              <div>
                <p className="text-xs text-gray-500 mt-2">Credit Limit</p>
                <p className="font-medium">{formatCurrency(account.creditLimit)}</p>
                {account.openBalance > account.creditLimit * 0.8 && (
                  <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="h-3 w-3" /> Approaching credit limit
                  </div>
                )}
              </div>
            )}
            {account.notes && <p className="text-xs text-gray-500 mt-2 border-t pt-2">{account.notes}</p>}
          </CardContent>
        </Card>

        {/* Outstanding invoices */}
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-1"><DollarSign className="h-4 w-4 text-red-500" /> Outstanding Invoices ({unpaidJobs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {unpaidJobs.length === 0 ? (
              <p className="text-sm text-gray-500">No outstanding invoices.</p>
            ) : (
              <div className="space-y-2">
                {unpaidJobs.map((j: { id: string; jobNumber: string; title: string; vehicle: { year: number; make: string; model: string }; fleetPoNumber?: string; invoice: { invoiceNumber: string; totalAmount: number; amountDue: number; status: string } }) => (
                  <div key={j.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <div>
                      <Link href={`/jobs/${j.id}`} className="font-medium text-blue-700 hover:underline">{j.title}</Link>
                      <p className="text-xs text-gray-500">{j.invoice.invoiceNumber} · {j.vehicle.year} {j.vehicle.make} {j.vehicle.model}</p>
                      {j.fleetPoNumber && <p className="text-xs text-gray-400">PO: {j.fleetPoNumber}</p>}
                    </div>
                    <div className="text-right">
                      <Badge className={`text-xs ${INVOICE_STATUS_COLORS[j.invoice.status] || ""}`}>{j.invoice.status}</Badge>
                      <p className="font-bold text-red-600 mt-1">{formatCurrency(j.invoice.amountDue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All jobs */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-1"><Wrench className="h-4 w-4 text-blue-500" /> Service History ({account.jobs?.length || 0} jobs)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(account.jobs || []).slice(0, 25).map((j: { id: string; jobNumber: string; title: string; status: string; createdAt: string; vehicle: { year: number; make: string; model: string; plate?: string }; fleetPoNumber?: string; invoice?: { totalAmount: number; status: string } }) => (
              <div key={j.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <Link href={`/jobs/${j.id}`} className="font-medium text-blue-700 hover:underline">{j.title}</Link>
                  <p className="text-xs text-gray-500">{j.jobNumber} · {j.vehicle.year} {j.vehicle.make} {j.vehicle.model} {j.vehicle.plate && `· ${j.vehicle.plate}`} · {formatDate(j.createdAt)}</p>
                  {j.fleetPoNumber && <p className="text-xs text-gray-400">PO: {j.fleetPoNumber}</p>}
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs">{j.status.replace(/_/g, " ")}</Badge>
                  {j.invoice && <p className="text-sm font-medium mt-1">{formatCurrency(j.invoice.totalAmount)}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
