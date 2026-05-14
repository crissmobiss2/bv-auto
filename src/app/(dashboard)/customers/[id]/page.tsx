"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Mail, MapPin, Car, Plus, Wrench,
  FileText, Receipt, ArrowLeft, Edit, Link2, MessageSquare,
  TrendingUp, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate, JOB_STATUS_COLORS, INVOICE_STATUS_COLORS, formatPhone } from "@/lib/utils";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Plus as PlusIcon, CheckCircle } from "lucide-react";
import { AddVehicleDialog } from "@/components/features/add-vehicle-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function SmsThread({ customerId, customerName }: { customerId: string; customerName: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: messages } = useQuery({
    queryKey: ["sms", customerId],
    queryFn: () => axios.get(`/api/sms/${customerId}`).then((r) => r.data),
    refetchInterval: 15000,
  });

  const sendMutation = useMutation({
    mutationFn: () => axios.post(`/api/sms/${customerId}`, { body: message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms", customerId] });
      setMessage("");
    },
  });

  const draftWithAi = async () => {
    if (!aiContext) return;
    setAiLoading(true);
    try {
      const res = await axios.post("/api/ai/message", {
        context: aiContext,
        customerName: customerName.split(" ")[0],
        tone: "friendly",
      });
      setMessage(res.data.message);
      setShowAi(false);
      setAiContext("");
    } catch { /* silent */ } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="max-h-64 overflow-y-auto space-y-2">
          {(!messages || messages.length === 0) ? (
            <p className="text-sm text-gray-500 text-center py-4">No messages yet. Send one below.</p>
          ) : (
            messages.map((msg: { id: string; direction: string; body: string; createdAt: string }) => (
              <div key={msg.id} className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.direction === "OUTBOUND" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                  <p>{msg.body}</p>
                  <p className={`text-xs mt-0.5 ${msg.direction === "OUTBOUND" ? "text-blue-200" : "text-gray-400"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {showAi && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-blue-800">AI Message Composer</p>
            <Input
              placeholder="What do you want to say? e.g. 'tell them car is ready for pickup'"
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && draftWithAi()}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={draftWithAi} disabled={!aiContext || aiLoading}>
                {aiLoading ? "Drafting..." : "Draft Message"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAi(false); setAiContext(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && message.trim() && sendMutation.mutate()}
          />
          <Button
            size="sm" variant="outline"
            onClick={() => setShowAi(!showAi)}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 flex-shrink-0"
          >
            AI
          </Button>
          <Button size="sm" onClick={() => sendMutation.mutate()} disabled={!message.trim() || sendMutation.isPending}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FollowUpTab({ customerId, followUps }: {
  customerId: string;
  followUps: { id: string; title: string; dueAt: string; notes?: string; isCompleted: boolean }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", notes: "", dueAt: "" });
  const [showAdd, setShowAdd] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => axios.post("/api/followups", { ...form, customerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setForm({ title: "", notes: "", dueAt: "" });
      setShowAdd(false);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (fuId: string) => axios.patch(`/api/followups/${fuId}`, { isCompleted: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer", customerId] }),
  });

  const active = followUps.filter((f) => !f.isCompleted);
  const done = followUps.filter((f) => f.isCompleted);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <PlusIcon className="h-4 w-4 mr-1" /> Add Follow-Up
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="e.g. Oil change due reminder" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.title || !form.dueAt || createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {active.length === 0 && !showAdd && (
        <p className="text-sm text-gray-500">No follow-ups scheduled.</p>
      )}

      {active.map((fu) => (
        <div key={fu.id} className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{fu.title}</p>
            <p className="text-xs text-blue-600">Due {formatDate(fu.dueAt)}</p>
            {fu.notes && <p className="text-xs text-gray-600 mt-1">{fu.notes}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => completeMutation.mutate(fu.id)}>
            <CheckCircle className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {done.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Completed ({done.length})</p>
          {done.map((fu) => (
            <div key={fu.id} className="p-2 text-sm text-gray-400 line-through">{fu.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => axios.get(`/api/customers/${id}`).then((r) => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!customer) return <div className="p-8 text-center text-red-500">Customer not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {customer.firstName} {customer.lastName}
          </h1>
          {customer.company && <p className="text-gray-500">{customer.company}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={async () => {
          const res = await axios.post(`/api/portal/${id}`);
          if (res.data.portalUrl) {
            await navigator.clipboard.writeText(res.data.portalUrl);
            alert("Portal link copied to clipboard!");
          }
        }}>
          <Link2 className="h-4 w-4 mr-1" /> Portal Link
        </Button>
        <Link href={`/jobs/new?customerId=${id}`}>
          <Button><Plus className="h-4 w-4 mr-2" /> New Job</Button>
        </Link>
      </div>

      {/* CLV Summary */}
      {customer.clv && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className={customer.clv.atRisk ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Lifetime Revenue</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(customer.clv.totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total Visits</p>
              <p className="text-xl font-bold">{customer.clv.visitCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Avg Ticket</p>
              <p className="text-xl font-bold">{formatCurrency(customer.clv.avgTicket)}</p>
            </CardContent>
          </Card>
          <Card className={customer.clv.atRisk ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">CLV Score</p>
                  <p className={`text-xl font-bold ${customer.clv.clvScore >= 60 ? "text-green-600" : customer.clv.clvScore >= 30 ? "text-yellow-600" : "text-red-600"}`}>
                    {customer.clv.clvScore}/100
                  </p>
                </div>
                {customer.clv.atRisk ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                )}
              </div>
              {customer.clv.atRisk && (
                <p className="text-xs text-red-600 mt-1">Last visit {customer.clv.daysSinceVisit}d ago</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">
                  {formatPhone(customer.phone)}
                </a>
              </div>
              {customer.altPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a href={`tel:${customer.altPhone}`} className="text-blue-600 hover:underline">
                    {formatPhone(customer.altPhone)} (alt)
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-700">
                    {customer.address}<br />
                    {[customer.city, customer.state, customer.zip].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicles */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Vehicles ({customer.vehicles?.length || 0})</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowAddVehicle(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {customer.vehicles?.length === 0 ? (
                <p className="text-sm text-gray-500">No vehicles on file.</p>
              ) : (
                customer.vehicles?.map((v: { id: string; year: number; make: string; model: string; plate?: string; vin?: string }) => (
                  <Link key={v.id} href={`/vehicles/${v.id}`} className="block p-2 rounded-md hover:bg-gray-50 border">
                    <p className="text-sm font-medium">{v.year} {v.make} {v.model}</p>
                    {(v.plate || v.vin) && (
                      <p className="text-xs text-gray-500">{v.plate || v.vin}</p>
                    )}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Jobs, Invoices, Notes */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="jobs">
            <TabsList>
              <TabsTrigger value="jobs">Jobs ({customer.jobs?.length || 0})</TabsTrigger>
              <TabsTrigger value="invoices">Invoices ({customer.invoices?.length || 0})</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {customer.jobs?.length === 0 ? (
                    <p className="text-sm text-gray-500 p-4">No jobs yet.</p>
                  ) : (
                    <div className="divide-y">
                      {customer.jobs?.map((job: { id: string; jobNumber: string; title: string; status: string; scheduledAt?: string; vehicle: { year: number; make: string; model: string } }) => (
                        <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium">{job.jobNumber} — {job.title}</p>
                            <p className="text-xs text-gray-500">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model} · {formatDate(job.scheduledAt)}</p>
                          </div>
                          <span className={`text-xs rounded-md px-2 py-0.5 font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                            {job.status.replace("_", " ")}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {customer.invoices?.length === 0 ? (
                    <p className="text-sm text-gray-500 p-4">No invoices yet.</p>
                  ) : (
                    <div className="divide-y">
                      {customer.invoices?.map((inv: { id: string; invoiceNumber: string; totalAmount: number; amountDue: number; status: string; createdAt: string }) => (
                        <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                            <p className="text-xs text-gray-500">{formatDate(inv.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(inv.totalAmount)}</p>
                            <span className={`text-xs rounded-md px-2 py-0.5 font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                              {inv.status}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {customer.customerNotes?.length === 0 ? (
                    <p className="text-sm text-gray-500">No notes yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {customer.customerNotes?.map((note: { id: string; content: string; isInternal: boolean; createdAt: string; author: { name: string } }) => (
                        <div key={note.id} className={`p-3 rounded-md text-sm ${note.isInternal ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                          <p>{note.content}</p>
                          <p className="text-xs text-gray-400 mt-1">{note.author.name} · {formatDate(note.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sms" className="mt-4">
              <SmsThread customerId={id} customerName={`${customer.firstName} ${customer.lastName}`} />
            </TabsContent>

            <TabsContent value="followups" className="mt-4">
              <FollowUpTab customerId={id} followUps={customer.followUps || []} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AddVehicleDialog
        open={showAddVehicle}
        onOpenChange={setShowAddVehicle}
        customerId={id}
        invalidateKeys={[["customer", id]]}
      />
    </div>
  );
}
