"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Car, Wrench, XCircle, Clock, CheckCircle, AlertCircle, Calendar,
  MessageSquare, Camera, Shield, Send, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS } from "@/lib/utils";
import { useState } from "react";

const JOB_TIMELINE: Record<string, { label: string; step: number; color: string }> = {
  ESTIMATE:        { label: "Estimate Created", step: 1, color: "bg-gray-400" },
  PENDING_APPROVAL:{ label: "Awaiting Approval", step: 2, color: "bg-yellow-400" },
  APPROVED:        { label: "Approved", step: 3, color: "bg-blue-400" },
  SCHEDULED:       { label: "Scheduled", step: 4, color: "bg-blue-500" },
  IN_PROGRESS:     { label: "In Progress", step: 5, color: "bg-orange-500" },
  PARTS_WAITING:   { label: "Waiting on Parts", step: 5, color: "bg-orange-400" },
  COMPLETED:       { label: "Completed", step: 6, color: "bg-green-500" },
  INVOICED:        { label: "Invoice Sent", step: 7, color: "bg-purple-500" },
  PAID:            { label: "Paid — Done!", step: 8, color: "bg-green-600" },
};

function JobStatusTimeline({ status }: { status: string }) {
  const steps = [
    { key: "SCHEDULED", label: "Scheduled" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "COMPLETED", label: "Complete" },
    { key: "PAID", label: "Paid" },
  ];
  const current = JOB_TIMELINE[status]?.step ?? 0;

  return (
    <div className="flex items-center gap-0 mt-2">
      {steps.map((step, i) => {
        const stepDef = JOB_TIMELINE[step.key];
        const done = current >= stepDef.step;
        const active = status === step.key || (step.key === "IN_PROGRESS" && status === "PARTS_WAITING");
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${done ? stepDef.color : "bg-gray-200"} ${active ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}>
              {done ? <CheckCircle className="h-3 w-3" /> : i + 1}
            </div>
            <span className={`text-xs ml-1 ${done ? "text-gray-700 font-medium" : "text-gray-400"} hidden sm:block`}>{step.label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${current > stepDef.step ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function CustomerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [message, setMessage] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => axios.get(`/api/portal/${token}`).then(r => r.data),
    retry: false,
  });

  const messageMutation = useMutation({
    mutationFn: () => axios.post(`/api/portal/${token}/message`, { body: message }),
    onSuccess: () => { setMessage(""); setMessageSent(true); setTimeout(() => setMessageSent(false), 4000); },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">Loading your portal...</p>
      </div>
    </div>
  );

  if (error || !customer) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold">Portal Link Not Found</h2>
          <p className="text-gray-500 mt-2">This link is invalid or expired. Call us to get a new one.</p>
          <a href="tel:5550001000" className="mt-4 inline-block text-blue-600 font-medium">(555) 000-1000</a>
        </CardContent>
      </Card>
    </div>
  );

  const pendingQuotes = customer.quotes || [];
  const openInvoices = (customer.invoices || []).filter((i: { status: string }) => !["PAID", "VOID"].includes(i.status));
  const totalOwed = openInvoices.reduce((s: number, i: { amountDue: number }) => s + Number(i.amountDue), 0);
  const activeJobs = (customer.jobs || []).filter((j: { status: string }) => !["PAID", "CANCELLED"].includes(j.status));
  const upcomingMaintenance = customer.vehicles?.flatMap((v: { year: number; make: string; model: string; maintenanceIntervals?: { serviceName: string; nextDueDate?: string; nextDueMiles?: number }[] }) =>
    (v.maintenanceIntervals || []).filter((m: { nextDueDate?: string }) => m.nextDueDate).map((m: { serviceName: string; nextDueDate?: string; nextDueMiles?: number }) => ({ ...m, vehicle: `${v.year} ${v.make} ${v.model}` }))
  ) || [];

  return (
    <div className="max-w-3xl mx-auto p-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-5 rounded-2xl inline-block mb-4 shadow-lg">
          <p className="text-2xl font-bold">B&V Mobile Auto</p>
          <p className="text-blue-300 text-sm mt-0.5">Your Personal Service Portal</p>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {customer.firstName}!</h1>
        <p className="text-gray-500 text-sm mt-1">View your service history, invoices, and more</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{customer.vehicles?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Vehicles</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{customer.jobs?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Service Visits</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className={`text-2xl font-bold ${totalOwed > 0 ? "text-orange-600" : "text-green-600"}`}>{formatCurrency(totalOwed)}</p>
          <p className="text-xs text-gray-500 mt-1">Balance Due</p>
        </CardContent></Card>
      </div>

      {/* Active job status */}
      {activeJobs.length > 0 && (
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-800 flex items-center gap-2"><Wrench className="h-4 w-4 animate-pulse" /> Active Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeJobs.map((job: { id: string; title: string; status: string; vehicle: { year: number; make: string; model: string }; vehicleHealthScore?: number; jobNotes?: { content: string; createdAt: string }[] }) => (
              <div key={job.id} className="bg-white rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{job.title}</p>
                  <Badge className="bg-blue-100 text-blue-700 text-xs">{job.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-xs text-gray-500 mb-2">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</p>
                <JobStatusTimeline status={job.status} />
                {job.vehicleHealthScore != null && (
                  <div className="mt-3 flex items-center gap-2">
                    <Shield className={`h-4 w-4 ${job.vehicleHealthScore >= 70 ? "text-green-600" : job.vehicleHealthScore >= 50 ? "text-yellow-600" : "text-red-600"}`} />
                    <span className="text-xs font-medium">Vehicle Health: {job.vehicleHealthScore}/100</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-1.5 rounded-full ${job.vehicleHealthScore >= 70 ? "bg-green-500" : job.vehicleHealthScore >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${job.vehicleHealthScore}%` }} />
                    </div>
                  </div>
                )}
                {job.jobNotes && job.jobNotes.length > 0 && (
                  <div className="mt-2 bg-blue-50 rounded p-2">
                    <p className="text-xs font-medium text-blue-700 mb-0.5">Technician Note:</p>
                    <p className="text-xs text-gray-700">{job.jobNotes[0].content}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending quotes */}
      {pendingQuotes.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-800 flex items-center gap-2"><Clock className="h-4 w-4" /> Estimates Awaiting Your Approval</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingQuotes.map((q: { id: string; quoteNumber: string; totalAmount: number; job: { vehicle: { year: number; make: string; model: string } }; approvalToken: string }) => (
              <div key={q.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200">
                <div>
                  <p className="font-medium text-sm">{q.quoteNumber}</p>
                  <p className="text-xs text-gray-500">{q.job?.vehicle?.year} {q.job?.vehicle?.make} {q.job?.vehicle?.model}</p>
                  <p className="font-bold text-yellow-700">{formatCurrency(q.totalAmount)}</p>
                </div>
                {q.approvalToken && (
                  <Link href={`/approve/${q.approvalToken}`}>
                    <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white">
                      Review <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="vehicles">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="message">Message</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4 space-y-3">
          {(customer.vehicles || []).map((v: { id: string; year: number; make: string; model: string; plate?: string; vin?: string; mileage?: number; maintenanceIntervals?: { id: string; serviceName: string; nextDueDate?: string; nextDueMiles?: number }[] }) => (
            <Card key={v.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Car className="h-8 w-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{v.year} {v.make} {v.model}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      {v.plate && <span>Plate: {v.plate}</span>}
                      {v.vin && <span>VIN: ...{v.vin.slice(-6)}</span>}
                      {v.mileage && <span>{v.mileage.toLocaleString()} mi</span>}
                    </div>
                  </div>
                </div>
                {v.maintenanceIntervals && v.maintenanceIntervals.length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1.5"><Calendar className="h-3 w-3" /> Upcoming Maintenance</p>
                    <div className="space-y-1">
                      {v.maintenanceIntervals.slice(0, 3).map(m => (
                        <div key={m.id} className="flex items-center justify-between text-xs bg-orange-50 rounded px-2 py-1">
                          <span className="font-medium text-gray-700">{m.serviceName}</span>
                          <span className="text-orange-600">{m.nextDueDate ? formatDate(m.nextDueDate) : m.nextDueMiles ? `${m.nextDueMiles.toLocaleString()} mi` : "Due soon"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!customer.vehicles?.length && <p className="text-sm text-gray-500 text-center py-8">No vehicles on file.</p>}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {(customer.jobs || []).map((job: { id: string; title: string; status: string; completedAt?: string; scheduledAt?: string; createdAt: string; vehicle: { year: number; make: string; model: string }; vehicleHealthScore?: number; photos?: { id: string; url: string; caption?: string }[]; jobNotes?: { content: string }[] }) => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{job.title}</p>
                    <p className="text-xs text-gray-500">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</p>
                    <p className="text-xs text-gray-400">{formatDate(job.completedAt || job.scheduledAt || job.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={`text-xs ${job.status === "PAID" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {job.status.replace(/_/g, " ")}
                    </Badge>
                    {job.vehicleHealthScore != null && (
                      <p className={`text-xs font-bold mt-1 ${job.vehicleHealthScore >= 70 ? "text-green-600" : "text-orange-600"}`}>
                        Health: {job.vehicleHealthScore}/100
                      </p>
                    )}
                  </div>
                </div>
                {job.jobNotes && job.jobNotes.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded p-2 italic">"{job.jobNotes[0].content}"</p>
                )}
                {job.photos && job.photos.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1.5"><Camera className="h-3 w-3" /> Photos ({job.photos.length})</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {job.photos.map(p => (
                        <div key={p.id} className="flex-shrink-0">
                          <Image src={p.url} alt={p.caption || "Job photo"} width={80} height={80} className="rounded-md object-cover w-20 h-20 border" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!customer.jobs?.length && <p className="text-sm text-gray-500 text-center py-8">No service history yet.</p>}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(customer.invoices || []).length === 0 ? (
                <p className="text-sm text-gray-500 p-4 text-center">No invoices yet.</p>
              ) : (
                <div className="divide-y">
                  {customer.invoices.map((inv: { id: string; invoiceNumber: string; totalAmount: number; amountDue: number; status: string; createdAt: string; stripePaymentUrl?: string }) => (
                    <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-500">{formatDate(inv.createdAt)} · {formatCurrency(inv.totalAmount)}</p>
                        {Number(inv.amountDue) > 0 && <p className="text-xs font-bold text-orange-600">Due: {formatCurrency(inv.amountDue)}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${INVOICE_STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-700"}`}>{inv.status}</Badge>
                        {inv.stripePaymentUrl && inv.status !== "PAID" && (
                          <a href={inv.stripePaymentUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700">Pay Now</Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="message" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-600" /> Message the Shop</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Message history */}
              {customer.smsMessages && customer.smsMessages.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50">
                  {[...(customer.smsMessages || [])].reverse().map((msg: { id: string; direction: string; body: string; createdAt: string }) => (
                    <div key={msg.id} className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.direction === "OUTBOUND" ? "bg-blue-600 text-white" : "bg-white border text-gray-900"}`}>
                        <p>{msg.body.replace("[Customer Portal] ", "")}</p>
                        <p className={`text-xs mt-0.5 ${msg.direction === "OUTBOUND" ? "text-blue-200" : "text-gray-400"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {messageSent && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-3 text-sm">
                  <CheckCircle className="h-4 w-4" /> Message sent! We'll respond shortly.
                </div>
              )}
              <Textarea
                rows={3}
                placeholder="Type your message to the shop..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => messageMutation.mutate()}
                disabled={!message.trim() || messageMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {messageMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
              <p className="text-xs text-gray-400 text-center">Messages appear in your service history and our team responds via SMS</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Maintenance alert */}
      {upcomingMaintenance.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="font-semibold text-orange-800 flex items-center gap-2 mb-2"><AlertCircle className="h-4 w-4" /> Upcoming Maintenance</p>
            <div className="space-y-1">
              {upcomingMaintenance.slice(0, 4).map((m: { serviceName: string; vehicle: string; nextDueDate?: string; nextDueMiles?: number }, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm text-orange-800">
                  <span>{m.serviceName} <span className="text-orange-600 text-xs">({m.vehicle})</span></span>
                  <span className="font-medium">{m.nextDueDate ? formatDate(m.nextDueDate) : `${m.nextDueMiles?.toLocaleString()} mi`}</span>
                </div>
              ))}
            </div>
            <Link href="/book" className="mt-3 block">
              <Button className="w-full bg-orange-500 hover:bg-orange-600">Schedule Service</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 text-center">
          <Wrench className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="font-semibold text-gray-900">Need Service?</p>
          <p className="text-sm text-gray-500 mb-3">Request an appointment online</p>
          <Link href="/book"><Button className="w-full">Request Service</Button></Link>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-gray-400">
        <p>Questions? <a href="tel:5550001000" className="text-blue-600">(555) 000-1000</a></p>
      </div>
    </div>
  );
}
