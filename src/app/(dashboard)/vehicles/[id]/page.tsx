"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Car, Edit, Wrench, Plus, Trash2, Bell, AlertOctagon, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { formatDate, JOB_STATUS_COLORS, formatCurrency, INVOICE_STATUS_COLORS } from "@/lib/utils";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface MaintenanceInterval {
  id: string; serviceName: string; intervalMiles?: number; intervalDays?: number;
  lastServiceMiles?: number; lastServiceDate?: string;
  nextDueMiles?: number; nextDueDate?: string; notes?: string;
}

function MaintenanceSection({ vehicleId }: { vehicleId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ serviceName: "", intervalMiles: "", intervalDays: "", lastServiceMiles: "", lastServiceDate: "", notes: "" });

  const { data: intervals } = useQuery({
    queryKey: ["maintenance", vehicleId],
    queryFn: () => axios.get(`/api/vehicles/${vehicleId}/maintenance`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => axios.post(`/api/vehicles/${vehicleId}/maintenance`, {
      serviceName: form.serviceName,
      intervalMiles: form.intervalMiles ? parseInt(form.intervalMiles) : undefined,
      intervalDays: form.intervalDays ? parseInt(form.intervalDays) : undefined,
      lastServiceMiles: form.lastServiceMiles ? parseInt(form.lastServiceMiles) : undefined,
      lastServiceDate: form.lastServiceDate || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance", vehicleId] });
      setForm({ serviceName: "", intervalMiles: "", intervalDays: "", lastServiceMiles: "", lastServiceDate: "", notes: "" });
      setShowAdd(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (intervalId: string) =>
      axios.delete(`/api/vehicles/${vehicleId}/maintenance/${intervalId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maintenance", vehicleId] }),
  });

  const isDueSoon = (interval: MaintenanceInterval) => {
    if (interval.nextDueDate) {
      const days = (new Date(interval.nextDueDate).getTime() - Date.now()) / 86400000;
      if (days <= 14) return true;
    }
    return false;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Maintenance Intervals</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Service Name *</Label>
                <Input placeholder="Oil Change" value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Every (miles)</Label>
                <Input type="number" placeholder="5000" value={form.intervalMiles} onChange={(e) => setForm({ ...form, intervalMiles: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Every (days)</Label>
                <Input type="number" placeholder="180" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Service Miles</Label>
                <Input type="number" value={form.lastServiceMiles} onChange={(e) => setForm({ ...form, lastServiceMiles: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Service Date</Label>
                <Input type="date" value={form.lastServiceDate} onChange={(e) => setForm({ ...form, lastServiceDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.serviceName || createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}

        {(!intervals || intervals.length === 0) && !showAdd && (
          <p className="text-xs text-gray-500">No maintenance intervals tracked.</p>
        )}

        {intervals?.map((interval: MaintenanceInterval) => (
          <div key={interval.id} className={`flex items-center justify-between p-2 rounded-md text-sm ${isDueSoon(interval) ? "bg-orange-50 border border-orange-200" : "bg-gray-50"}`}>
            <div>
              <p className="font-medium">{interval.serviceName}</p>
              <p className="text-xs text-gray-500">
                {interval.intervalMiles && `Every ${interval.intervalMiles.toLocaleString()} mi`}
                {interval.intervalMiles && interval.intervalDays && " · "}
                {interval.intervalDays && `Every ${interval.intervalDays} days`}
              </p>
              {interval.nextDueMiles && <p className="text-xs text-gray-500">Next due: {interval.nextDueMiles.toLocaleString()} mi</p>}
              {interval.nextDueDate && (
                <p className={`text-xs font-medium ${isDueSoon(interval) ? "text-orange-600" : "text-gray-500"}`}>
                  Due: {new Date(interval.nextDueDate).toLocaleDateString()}
                  {isDueSoon(interval) && " ⚠️"}
                </p>
              )}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-500"
              onClick={() => deleteMutation.mutate(interval.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecallAlerts({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["recalls", vehicleId],
    queryFn: () => axios.get(`/api/vehicles/${vehicleId}/recalls`).then((r) => r.data),
    staleTime: 3600000,
  });

  if (isLoading) return null;
  const recalls: { id: string; component: string; summary: string; remedy?: string }[] = data?.recalls || [];
  if (recalls.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        No open NHTSA safety recalls found for this vehicle
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-300 rounded-lg">
        <AlertOctagon className="h-5 w-5 text-red-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-red-800">{recalls.length} Open Safety Recall{recalls.length > 1 ? "s" : ""} — NHTSA</span>
      </div>
      {recalls.map((r) => (
        <div key={r.id} className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-red-800">{r.component}</p>
              <p className="text-xs text-red-700 mt-1">{r.summary}</p>
              {r.remedy && <p className="text-xs text-gray-600 mt-1"><span className="font-medium">Remedy:</span> {r.remedy}</p>}
            </div>
            <span className="text-xs font-mono text-gray-400 flex-shrink-0">{r.id}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => axios.get(`/api/vehicles/${id}`).then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) =>
      axios.patch(`/api/vehicles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      setShowEdit(false);
    },
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!vehicle) return <div className="p-8 text-center text-red-500">Vehicle not found.</div>;

  const openEdit = () => {
    setEditForm({
      year: String(vehicle.year),
      make: vehicle.make || "",
      model: vehicle.model || "",
      trim: vehicle.trim || "",
      color: vehicle.color || "",
      vin: vehicle.vin || "",
      plate: vehicle.plate || "",
      plateState: vehicle.plateState || "",
      mileage: String(vehicle.mileage || ""),
      engine: vehicle.engine || "",
      transmission: vehicle.transmission || "",
    });
    setShowEdit(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/vehicles">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.trim && <span className="text-gray-500 ml-2 text-lg">{vehicle.trim}</span>}
          </h1>
          <Link href={`/customers/${vehicle.customer?.id}`} className="text-sm text-blue-600 hover:underline">
            {vehicle.customer?.firstName} {vehicle.customer?.lastName}
          </Link>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Edit className="h-4 w-4 mr-1" /> Edit
        </Button>
        <Link href={`/jobs/new?customerId=${vehicle.customerId}`}>
          <Button size="sm"><Wrench className="h-4 w-4 mr-1" /> New Job</Button>
        </Link>
      </div>

      {/* NHTSA Recall Alerts */}
      <RecallAlerts vehicleId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Car className="h-4 w-4" /> Vehicle Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Year", vehicle.year],
                ["Make", vehicle.make],
                ["Model", vehicle.model],
                ["Trim", vehicle.trim],
                ["Color", vehicle.color],
                ["VIN", vehicle.vin],
                ["Plate", vehicle.plate ? `${vehicle.plate}${vehicle.plateState ? ` (${vehicle.plateState})` : ""}` : null],
                ["Mileage", vehicle.mileage ? vehicle.mileage.toLocaleString() + " mi" : null],
                ["Engine", vehicle.engine],
                ["Transmission", vehicle.transmission],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{String(value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {vehicle.carfaxRecords?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">CARFAX Reports</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {vehicle.carfaxRecords.map((r: { id: string; createdAt: string; status: string }) => (
                  <div key={r.id} className="flex justify-between">
                    <span className="text-gray-500">{formatDate(r.createdAt)}</span>
                    <span className="text-xs font-medium">{r.status}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Maintenance Intervals */}
        <MaintenanceSection vehicleId={id} />

        {/* Job History */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Service History ({vehicle.jobs?.length || 0} jobs)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!vehicle.jobs?.length ? (
                <p className="text-sm text-gray-500 p-4">No service history yet.</p>
              ) : (
                <div className="divide-y">
                  {vehicle.jobs.map((job: {
                    id: string;
                    jobNumber: string;
                    title: string;
                    status: string;
                    scheduledAt?: string;
                    createdAt: string;
                    quote?: { totalAmount: number };
                    invoice?: { totalAmount: number; amountDue: number; status: string; id: string };
                  }) => (
                    <div key={job.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                            {job.jobNumber} — {job.title}
                          </Link>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDate(job.scheduledAt || job.createdAt)}
                          </p>
                        </div>
                        <span className={`text-xs rounded-md px-2 py-0.5 font-medium whitespace-nowrap ${JOB_STATUS_COLORS[job.status]}`}>
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      {job.invoice && (
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <Link href={`/invoices/${job.invoice.id}`} className="text-blue-600 hover:underline">
                            Invoice: {formatCurrency(job.invoice.totalAmount)}
                          </Link>
                          <span className={`rounded px-1.5 py-0.5 font-medium ${INVOICE_STATUS_COLORS[job.invoice.status]}`}>
                            {job.invoice.status}
                          </span>
                          {Number(job.invoice.amountDue) > 0 && (
                            <span className="text-orange-600">Due: {formatCurrency(job.invoice.amountDue)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Vehicle</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Year", key: "year", type: "number" },
              { label: "Make", key: "make" },
              { label: "Model", key: "model" },
              { label: "Trim", key: "trim" },
              { label: "Color", key: "color" },
              { label: "VIN", key: "vin" },
              { label: "Plate", key: "plate" },
              { label: "Plate State", key: "plateState" },
              { label: "Mileage", key: "mileage", type: "number" },
              { label: "Engine", key: "engine" },
              { label: "Transmission", key: "transmission" },
            ].map(({ label, key, type }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type={type || "text"}
                  value={editForm[key] || ""}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const data: Record<string, string | number> = { ...editForm };
                if (data.year) data.year = parseInt(String(data.year));
                if (data.mileage) data.mileage = parseInt(String(data.mileage));
                updateMutation.mutate(data);
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
