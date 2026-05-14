"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { AddVehicleDialog } from "@/components/features/add-vehicle-dialog";

function NewJobForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const preCustomerId = searchParams.get("customerId") || "";

  const [form, setForm] = useState({
    customerId: preCustomerId,
    vehicleId: "",
    technicianId: "",
    title: searchParams.get("service") || "",
    description: "",
    serviceLocation: "",
    scheduledAt: "",
    estimatedHours: "",
    mileageIn: "",
    internalNotes: "",
    customerNotes: "",
  });
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: () => axios.get("/api/customers?limit=200").then((r) => r.data.customers),
  });

  const { data: vehicles, refetch: refetchVehicles } = useQuery({
    queryKey: ["vehicles", form.customerId],
    queryFn: () => axios.get(`/api/vehicles?customerId=${form.customerId}`).then((r) => r.data),
    enabled: !!form.customerId,
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => axios.get("/api/users?role=TECHNICIAN").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      axios.post("/api/jobs", {
        ...data,
        estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : undefined,
        mileageIn: data.mileageIn ? parseInt(data.mileageIn) : undefined,
        technicianId: data.technicianId || undefined,
        scheduledAt: data.scheduledAt || undefined,
      }),
    onSuccess: (res) => router.push(`/jobs/${res.data.id}`),
  });

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  const hasVehicles = vehicles && vehicles.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/jobs"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">New Job</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Job Title *</Label>
              <Input placeholder="e.g. Oil Change, Brake Replacement" {...f("title")} />
            </div>

            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v, vehicleId: "" })}>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c: { id: string; firstName: string; lastName: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vehicle *</Label>
              {form.customerId && !hasVehicles ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed text-blue-600 hover:text-blue-700"
                  onClick={() => setShowAddVehicle(true)}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Vehicle for this Customer
                </Button>
              ) : (
                <Select
                  value={form.vehicleId}
                  onValueChange={(v) => setForm({ ...form, vehicleId: v })}
                  disabled={!form.customerId}
                >
                  <SelectTrigger><SelectValue placeholder={form.customerId ? "Select vehicle..." : "Select customer first"} /></SelectTrigger>
                  <SelectContent>
                    {vehicles?.map((v: { id: string; year: number; make: string; model: string }) => (
                      <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.customerId && hasVehicles && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline mt-1"
                  onClick={() => setShowAddVehicle(true)}
                >
                  + Add another vehicle
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Technician</Label>
              <Select value={form.technicianId} onValueChange={(v) => setForm({ ...form, technicianId: v })}>
                <SelectTrigger><SelectValue placeholder="Assign technician..." /></SelectTrigger>
                <SelectContent>
                  {technicians?.map((t: { id: string; name: string }) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date & Time</Label>
              <Input type="datetime-local" {...f("scheduledAt")} />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Service Location</Label>
              <Input placeholder="Customer address or drop-off location" {...f("serviceLocation")} />
            </div>

            <div className="space-y-2">
              <Label>Estimated Hours</Label>
              <Input type="number" step="0.5" min="0" {...f("estimatedHours")} />
            </div>

            <div className="space-y-2">
              <Label>Mileage In</Label>
              <Input type="number" {...f("mileageIn")} />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} placeholder="Brief description of the repair..." {...f("description")} />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Customer Notes (visible to customer)</Label>
              <Textarea rows={2} {...f("customerNotes")} />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Internal Notes</Label>
              <Textarea rows={2} {...f("internalNotes")} />
            </div>
          </div>

          {createMutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {(createMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create job."}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/jobs"><Button variant="outline">Cancel</Button></Link>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title || !form.customerId || !form.vehicleId || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {form.customerId && (
        <AddVehicleDialog
          open={showAddVehicle}
          onOpenChange={setShowAddVehicle}
          customerId={form.customerId}
          onSuccess={(vehicle) => {
            refetchVehicles();
            setForm((f) => ({ ...f, vehicleId: vehicle.id }));
          }}
          invalidateKeys={[["vehicles", form.customerId]]}
        />
      )}
    </div>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto p-8 text-center text-gray-500">Loading...</div>}>
      <NewJobForm />
    </Suspense>
  );
}
