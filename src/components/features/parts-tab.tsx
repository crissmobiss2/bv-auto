"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, RefreshCcw } from "lucide-react";
import { formatCurrency, PART_STATUS_COLORS } from "@/lib/utils";

const PART_STATUSES = ["REQUESTED", "QUOTED", "ORDERED", "SHIPPED", "PICKED_UP", "RECEIVED", "INSTALLED", "RETURNED", "CREDITED", "CANCELLED"];

type Part = {
  id: string;
  partNumber?: string;
  description: string;
  quantity: number;
  unitCost?: number;
  unitPrice?: number;
  totalPrice?: number;
  status: string;
  vendor?: { id: string; name: string } | null;
  notes?: string;
  returnReason?: string;
  creditAmount?: number;
  coreReturn?: boolean;
  coreCharge?: number;
  poNumber?: string;
};

export function PartsTab({ job }: { job: { id: string; parts: Part[] } }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    description: "", partNumber: "", quantity: "1",
    unitCost: "", unitPrice: "", markup: "",
    vendorId: "", notes: "", coreReturn: false, coreCharge: "",
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => axios.get("/api/vendors").then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      axios.post("/api/parts", {
        jobId: job.id,
        ...form,
        quantity: parseFloat(form.quantity) || 1,
        unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
        unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : undefined,
        markup: form.markup ? parseFloat(form.markup) : undefined,
        coreCharge: form.coreCharge ? parseFloat(form.coreCharge) : undefined,
        vendorId: form.vendorId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", job.id] });
      setShowAdd(false);
      setForm({ description: "", partNumber: "", quantity: "1", unitCost: "", unitPrice: "", markup: "", vendorId: "", notes: "", coreReturn: false, coreCharge: "" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ partId, status }: { partId: string; status: string }) =>
      axios.patch(`/api/parts/${partId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", job.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (partId: string) => axios.delete(`/api/parts/${partId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", job.id] }),
  });

  const parts: Part[] = job.parts || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{parts.length} part{parts.length !== 1 ? "s" : ""} on this job</p>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Part
        </Button>
      </div>

      {parts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500 text-sm">
            No parts added yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {parts.map((part) => (
            <Card key={part.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{part.description}</p>
                      {part.partNumber && <span className="text-xs text-gray-400 font-mono">{part.partNumber}</span>}
                    </div>
                    {part.vendor && <p className="text-xs text-gray-500 mt-0.5">Vendor: {part.vendor.name}</p>}
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>Qty: {part.quantity}</span>
                      {part.unitCost && <span>Cost: {formatCurrency(part.unitCost)}</span>}
                      {part.unitPrice && <span>Price: {formatCurrency(part.unitPrice)}</span>}
                      {part.totalPrice && <span className="font-medium text-gray-700">Total: {formatCurrency(part.totalPrice)}</span>}
                      {part.coreReturn && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Core: {part.coreCharge ? formatCurrency(part.coreCharge) : "TBD"}</span>}
                      {part.poNumber && <span>PO: {part.poNumber}</span>}
                    </div>
                    {part.creditAmount && <p className="text-xs text-green-600 mt-0.5">Credit: {formatCurrency(part.creditAmount)}</p>}
                    {part.returnReason && <p className="text-xs text-red-500 mt-0.5">Return: {part.returnReason}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select value={part.status} onValueChange={(v) => statusMutation.mutate({ partId: part.id, status: v })}>
                      <SelectTrigger className={`w-36 text-xs h-8 ${PART_STATUS_COLORS[part.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PART_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400"
                      onClick={() => deleteMutation.mutate(part.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {part.notes && <p className="text-xs text-gray-500 mt-2 italic">{part.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Part</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Part Number</Label>
              <Input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min="0.5" step="0.5" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost</Label>
              <Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Markup %</Label>
              <Input type="number" min="0" value={form.markup} onChange={(e) => setForm({ ...form, markup: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Vendor</Label>
              <Select value={form.vendorId} onValueChange={(v) => setForm({ ...form, vendorId: v })}>
                <SelectTrigger><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                <SelectContent>
                  {vendors?.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.description || addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
