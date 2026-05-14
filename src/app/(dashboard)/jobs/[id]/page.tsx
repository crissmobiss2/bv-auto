"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, Wrench, FileText, Package, Camera, ClipboardCheck, PenLine, Clock, Play, Square, Brain, X, Plus, AlertTriangle, DollarSign } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { formatCurrency, formatDate, formatDateTime, JOB_STATUS_COLORS, PART_STATUS_COLORS } from "@/lib/utils";
import { QuoteBuilder } from "@/components/features/quote-builder";
import { InspectionChecklist } from "@/components/features/inspection-checklist";
import { PartsTab } from "@/components/features/parts-tab";
import { NotesTab } from "@/components/features/notes-tab";
import { SignaturePad } from "@/components/features/signature-pad";
import { PhotoUpload } from "@/components/features/photo-upload";

function TimeTracker({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["timelog", jobId],
    queryFn: () => axios.get(`/api/jobs/${jobId}/timelog`).then((r) => r.data),
    refetchInterval: 30000,
  });

  const clockMutation = useMutation({
    mutationFn: (payload: { action: "clock-in" | "clock-out"; logId?: string }) =>
      axios.post(`/api/jobs/${jobId}/timelog`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timelog", jobId] }),
  });

  const openLog = data?.logs?.find((l: { clockedOut: string | null }) => !l.clockedOut);
  const totalH = Math.floor((data?.totalMinutes || 0) / 60);
  const totalM = (data?.totalMinutes || 0) % 60;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Time Tracking</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Total: {totalH}h {totalM}m</span>
          {openLog ? (
            <Button size="sm" variant="destructive" className="h-7 text-xs"
              onClick={() => clockMutation.mutate({ action: "clock-out", logId: openLog.id })}
              disabled={clockMutation.isPending}>
              <Square className="h-3 w-3 mr-1" /> Clock Out
            </Button>
          ) : (
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => clockMutation.mutate({ action: "clock-in" })}
              disabled={clockMutation.isPending}>
              <Play className="h-3 w-3 mr-1" /> Clock In
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {(!data?.logs || data.logs.length === 0) ? (
          <p className="text-xs text-gray-500">No time logged yet.</p>
        ) : (
          <div className="space-y-1">
            {data.logs.map((log: { id: string; clockedIn: string; clockedOut?: string; technician: { name: string } }) => {
              const mins = log.clockedOut
                ? Math.round((new Date(log.clockedOut).getTime() - new Date(log.clockedIn).getTime()) / 60000)
                : null;
              return (
                <div key={log.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                  <div>
                    <span className="font-medium">{log.technician.name}</span>
                    <span className="text-gray-400 ml-2">{new Date(log.clockedIn).toLocaleTimeString()}</span>
                    {log.clockedOut && <span className="text-gray-400"> → {new Date(log.clockedOut).toLocaleTimeString()}</span>}
                    {!log.clockedOut && <span className="text-green-600 ml-1 font-medium">● ACTIVE</span>}
                  </div>
                  {mins !== null && <span className="font-medium">{Math.floor(mins / 60)}h {mins % 60}m</span>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeclinedServicesTab({ jobId, customerId, vehicleId }: { jobId: string; customerId: string; vehicleId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: "", reason: "", estimatedPrice: "", followUpAt: "" });

  const { data: declined = [] } = useQuery({
    queryKey: ["declined", jobId],
    queryFn: () => axios.get(`/api/jobs/${jobId}/declined`).then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${jobId}/declined`, {
      ...form,
      customerId, vehicleId,
      estimatedPrice: form.estimatedPrice ? parseFloat(form.estimatedPrice) : undefined,
      followUpAt: form.followUpAt || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["declined", jobId] });
      setForm({ description: "", reason: "", estimatedPrice: "", followUpAt: "" });
      setShowAdd(false);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Add Declined Service
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Service Description *</Label>
                <Input placeholder="e.g. Rear brake pad replacement" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason Declined</Label>
                <Input placeholder="Cost, come back later..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estimated Price ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.estimatedPrice} onChange={(e) => setForm({ ...form, estimatedPrice: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Follow-Up Date</Label>
                <Input type="date" value={form.followUpAt} onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={() => addMutation.mutate()} disabled={!form.description || addMutation.isPending}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {declined.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-500">No declined services on this job.</p>
      ) : (
        <div className="space-y-2">
          {declined.map((d: { id: string; description: string; reason?: string; estimatedPrice?: number; followUpAt?: string; followedUp: boolean }) => (
            <div key={d.id} className="p-3 rounded-md border bg-orange-50 border-orange-200 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{d.description}</p>
                  {d.reason && <p className="text-xs text-gray-500 mt-0.5">Reason: {d.reason}</p>}
                  <div className="flex gap-3 mt-1">
                    {d.estimatedPrice && (
                      <span className="text-xs text-orange-700 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />${Number(d.estimatedPrice).toFixed(2)}
                      </span>
                    )}
                    {d.followUpAt && (
                      <span className="text-xs text-gray-500">Follow-up: {new Date(d.followUpAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                {d.followedUp && <span className="text-xs text-green-600 font-medium">Followed up</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickDiagnoseTab({ job }: { job: { id: string; title: string; vehicle: { year: number; make: string; model: string; mileage?: number } } }) {
  const [symptoms, setSymptoms] = useState(job.title || "");
  const [dtcInput, setDtcInput] = useState("");
  const [dtcList, setDtcList] = useState<string[]>([]);
  const [result, setResult] = useState<null | { summary: string; diagnoses: { rank: number; cause: string; probability: string; repairNeeded: string; estimatedLaborHours: number; estimatedPartsCost: string; urgency: string }[]; recommendedServices: { service: string; priority: string }[] }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addDtc = () => {
    const c = dtcInput.trim().toUpperCase();
    if (c && !dtcList.includes(c)) setDtcList([...dtcList, c]);
    setDtcInput("");
  };

  const run = async () => {
    setLoading(true); setError("");
    try {
      const res = await axios.post("/api/ai/diagnose", {
        year: job.vehicle.year, make: job.vehicle.make, model: job.vehicle.model,
        mileage: job.vehicle.mileage, symptoms, dtcCodes: dtcList,
      });
      setResult(res.data);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Diagnosis failed");
    } finally {
      setLoading(false);
    }
  };

  const URGENCY: Record<string, string> = {
    Immediate: "text-red-700 bg-red-50 border-red-200",
    Soon: "text-yellow-700 bg-yellow-50 border-yellow-200",
    Monitor: "text-green-700 bg-green-50 border-green-200",
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Symptoms / Complaint</Label>
          <Textarea rows={3} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Describe what the customer reports..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">DTC Codes (optional)</Label>
          <div className="flex gap-2">
            <Input className="font-mono" placeholder="P0300" value={dtcInput} onChange={(e) => setDtcInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && addDtc()} />
            <Button type="button" size="sm" variant="outline" onClick={addDtc}><Plus className="h-4 w-4" /></Button>
          </div>
          {dtcList.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dtcList.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                  {c}<button onClick={() => setDtcList(dtcList.filter((x) => x !== c))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <Button onClick={run} disabled={!symptoms || loading} className="w-full">
          {loading ? <><Brain className="h-4 w-4 mr-2 animate-pulse" /> Analyzing...</> : <><Brain className="h-4 w-4 mr-2" /> AI Diagnose</>}
        </Button>
        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      </div>

      {result && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-900">{result.summary}</div>
          {result.diagnoses.map((d) => (
            <div key={d.rank} className={`p-3 rounded border text-sm ${URGENCY[d.urgency] || "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-white border rounded-full w-5 h-5 flex items-center justify-center">{d.rank}</span>
                <span className="font-semibold">{d.cause}</span>
                <span className="ml-auto text-xs opacity-75">{d.probability} · {d.urgency}</span>
              </div>
              <p className="text-xs opacity-80">Fix: {d.repairNeeded} · {d.estimatedLaborHours}h · Parts: {d.estimatedPartsCost}</p>
            </div>
          ))}
          {result.recommendedServices?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Also Recommend:</p>
              {result.recommendedServices.map((s, i) => (
                <div key={i} className="text-xs text-gray-600 py-0.5">• {s.service}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <p className="text-xs text-gray-400 text-center py-4">
          AI diagnosis powered by Claude — contextual to {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
        </p>
      )}
    </div>
  );
}

const JOB_STATUSES = [
  "ESTIMATE", "PENDING_APPROVAL", "APPROVED", "SCHEDULED",
  "IN_PROGRESS", "PARTS_WAITING", "COMPLETED", "INVOICED", "PAID", "CANCELLED",
];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => axios.get(`/api/jobs/${id}`).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => axios.patch(`/api/jobs/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", id] }),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () => axios.post("/api/invoices", { jobId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", id] }),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!job) return <div className="p-8 text-center text-red-500">Job not found.</div>;

  const canCreateInvoice = job.quote?.status === "APPROVED" && !job.invoice;
  const canConvertToQuote = !job.quote;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/jobs"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{job.title}</h1>
            <span className="font-mono text-xs text-gray-500">{job.jobNumber}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.customer.firstName} {job.customer.lastName} · {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={job.status} onValueChange={(v) => statusMutation.mutate(v)}>
            <SelectTrigger className={`w-40 text-xs font-medium ${JOB_STATUS_COLORS[job.status]}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canCreateInvoice && (
            <Button size="sm" onClick={() => createInvoiceMutation.mutate()} disabled={createInvoiceMutation.isPending}>
              <FileText className="h-4 w-4 mr-1" />
              {createInvoiceMutation.isPending ? "..." : "Create Invoice"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Info sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Customer</p>
                <Link href={`/customers/${job.customer.id}`} className="text-blue-600 hover:underline font-medium">
                  {job.customer.firstName} {job.customer.lastName}
                </Link>
                <a href={`tel:${job.customer.phone}`} className="flex items-center gap-1 text-gray-600 text-xs mt-0.5">
                  <Phone className="h-3 w-3" /> {job.customer.phone}
                </a>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Vehicle</p>
                <p className="font-medium">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</p>
                {job.vehicle.plate && <p className="text-xs text-gray-500">Plate: {job.vehicle.plate}</p>}
                {job.vehicle.vin && <p className="text-xs text-gray-500">VIN: {job.vehicle.vin}</p>}
                {job.mileageIn && <p className="text-xs text-gray-500">Mileage In: {job.mileageIn.toLocaleString()}</p>}
              </div>
              {job.technician && (
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Technician</p>
                  <p className="font-medium">{job.technician.name}</p>
                </div>
              )}
              {job.scheduledAt && (
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Scheduled</p>
                  <p className="font-medium">{formatDateTime(job.scheduledAt)}</p>
                </div>
              )}
              {job.serviceLocation && (
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Location</p>
                  <p className="text-gray-700">{job.serviceLocation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <TimeTracker jobId={job.id} />

          {/* Financial Summary */}
          {(job.quote || job.invoice) && (
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Financial</p>
                {job.quote && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quote</span>
                    <span className="font-medium">{formatCurrency(job.quote.totalAmount)}</span>
                  </div>
                )}
                {job.invoice && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Invoice</span>
                      <span className="font-medium">{formatCurrency(job.invoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Paid</span>
                      <span className="text-green-600 font-medium">{formatCurrency(job.invoice.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Balance Due</span>
                      <span className="font-bold text-orange-600">{formatCurrency(job.invoice.amountDue)}</span>
                    </div>
                    <Link href={`/invoices/${job.invoice.id}`} className="text-xs text-blue-600 hover:underline block">
                      View Invoice →
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue={job.quote ? "quote" : "quote"}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="quote">
                <FileText className="h-4 w-4 mr-1" />
                {job.quote ? "Quote" : "Build Quote"}
              </TabsTrigger>
              <TabsTrigger value="parts">
                <Package className="h-4 w-4 mr-1" />
                Parts ({job.parts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="inspection">
                <ClipboardCheck className="h-4 w-4 mr-1" />
                Inspection
              </TabsTrigger>
              <TabsTrigger value="notes">
                <Wrench className="h-4 w-4 mr-1" />
                Notes ({job.jobNotes?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="photos">
                <Camera className="h-4 w-4 mr-1" />
                Photos ({job.photos?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="signature">
                <PenLine className="h-4 w-4 mr-1" />
                Signature
              </TabsTrigger>
              <TabsTrigger value="diagnose">
                <Brain className="h-4 w-4 mr-1" />
                AI Diagnose
              </TabsTrigger>
              <TabsTrigger value="declined">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Declined
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quote" className="mt-4">
              <QuoteBuilder job={job} />
            </TabsContent>

            <TabsContent value="parts" className="mt-4">
              <PartsTab job={job} />
            </TabsContent>

            <TabsContent value="inspection" className="mt-4">
              <InspectionChecklist job={job} />
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <NotesTab jobId={job.id} notes={job.jobNotes || []} />
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <PhotoUpload jobId={job.id} photos={job.photos || []} />
            </TabsContent>

            <TabsContent value="signature" className="mt-4">
              <SignaturePad jobId={job.id} signatures={job.signatures || []} />
            </TabsContent>

            <TabsContent value="diagnose" className="mt-4">
              <QuickDiagnoseTab job={job} />
            </TabsContent>

            <TabsContent value="declined" className="mt-4">
              <DeclinedServicesTab jobId={job.id} customerId={job.customer.id} vehicleId={job.vehicle.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
