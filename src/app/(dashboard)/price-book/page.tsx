"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, BookOpen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Part { description: string; partNumber?: string; quantity: number; unitPrice: number }
interface CannedService {
  id: string; name: string; category?: string; description?: string;
  laborHours: number; laborPrice: number; parts?: Part[]; totalPrice: number; isActive: boolean;
}

const BLANK = {
  name: "", category: "", description: "", laborHours: "0", laborPrice: "0", totalPrice: "0", parts: [] as Part[],
};

export default function PriceBookPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [editItem, setEditItem] = useState<CannedService | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);

  const { data } = useQuery({
    queryKey: ["canned-services", filterCat, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterCat) params.set("category", filterCat);
      if (search) params.set("q", search);
      return axios.get(`/api/canned-services?${params}`).then((r) => r.data);
    },
  });

  const services: CannedService[] = data?.services || [];
  const categories: string[] = data?.categories || [];

  const upsert = useMutation({
    mutationFn: (d: typeof form) => {
      const payload = {
        ...d,
        laborHours: parseFloat(d.laborHours) || 0,
        laborPrice: parseFloat(d.laborPrice) || 0,
        totalPrice: parseFloat(d.totalPrice) || 0,
      };
      return editItem
        ? axios.patch(`/api/canned-services/${editItem.id}`, payload)
        : axios.post("/api/canned-services", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-services"] });
      setShowForm(false);
      setEditItem(null);
      setForm(BLANK);
    },
  });

  const deleteSvc = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/canned-services/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["canned-services"] }),
  });

  const openEdit = (s: CannedService) => {
    setEditItem(s);
    setForm({
      name: s.name, category: s.category || "", description: s.description || "",
      laborHours: String(s.laborHours), laborPrice: String(s.laborPrice),
      totalPrice: String(s.totalPrice), parts: s.parts || [],
    });
    setShowForm(true);
  };

  const autoTotal = () => {
    const labor = parseFloat(form.laborPrice) || 0;
    const parts = form.parts.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0);
    setForm((f) => ({ ...f, totalPrice: (labor + parts).toFixed(2) }));
  };

  const addPart = () => setForm((f) => ({ ...f, parts: [...f.parts, { description: "", quantity: 1, unitPrice: 0 }] }));
  const updatePart = (i: number, key: keyof Part, val: string | number) =>
    setForm((f) => ({ ...f, parts: f.parts.map((p, idx) => idx === i ? { ...p, [key]: val } : p) }));
  const removePart = (i: number) => setForm((f) => ({ ...f, parts: f.parts.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Price Book
          </h1>
          <p className="text-sm text-gray-500">Canned services — one click to add to any estimate</p>
        </div>
        <Button onClick={() => { setEditItem(null); setForm(BLANK); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Service
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={!filterCat ? "default" : "outline"} size="sm" onClick={() => setFilterCat("")}>All</Button>
          {categories.map((c) => (
            <Button key={c} variant={filterCat === c ? "default" : "outline"} size="sm" onClick={() => setFilterCat(c || "")}>{c}</Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {services.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No services yet</p>
              <p className="text-sm mt-1">Add canned services to speed up estimating</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Labor Hrs</TableHead>
                  <TableHead className="hidden md:table-cell">Labor</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-500 truncate max-w-xs">{s.description}</p>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {s.category && <Badge variant="outline">{s.category}</Badge>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{s.laborHours}h</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{formatCurrency(s.laborPrice)}</TableCell>
                    <TableCell className="font-semibold text-sm">{formatCurrency(s.totalPrice)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteSvc.mutate(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditItem(null); setForm(BLANK); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Service" : "Add Canned Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Service Name *</Label>
                <Input placeholder="e.g. Full Synthetic Oil Change" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input placeholder="e.g. Maintenance, Brakes..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Labor Hours</Label>
                <Input type="number" step="0.25" min="0" value={form.laborHours} onChange={(e) => setForm({ ...form, laborHours: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Labor Price ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.laborPrice} onChange={(e) => setForm({ ...form, laborPrice: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Description</Label>
                <Textarea rows={2} placeholder="What's included..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Parts Included</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPart}><Plus className="h-3 w-3 mr-1" /> Add Part</Button>
              </div>
              {form.parts.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5" placeholder="Description" value={p.description} onChange={(e) => updatePart(i, "description", e.target.value)} />
                  <Input className="col-span-2" placeholder="Part #" value={p.partNumber || ""} onChange={(e) => updatePart(i, "partNumber", e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="Qty" min="1" value={p.quantity} onChange={(e) => updatePart(i, "quantity", parseFloat(e.target.value))} />
                  <Input className="col-span-2" type="number" placeholder="Price" min="0" step="0.01" value={p.unitPrice} onChange={(e) => updatePart(i, "unitPrice", parseFloat(e.target.value))} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removePart(i)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>Total Price ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
              </div>
              <Button type="button" variant="outline" onClick={autoTotal}>Auto-calculate</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditItem(null); setForm(BLANK); }}>Cancel</Button>
            <Button onClick={() => upsert.mutate(form)} disabled={!form.name || upsert.isPending}>
              {upsert.isPending ? "Saving..." : editItem ? "Update" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
