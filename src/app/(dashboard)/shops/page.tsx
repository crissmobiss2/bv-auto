"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, MapPin, Phone, Mail, Star, Edit, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Shop {
  id: string; name: string; address?: string; city?: string; state?: string; zip?: string;
  phone?: string; email?: string; taxRate: number; laborRate: number;
  googleReviewUrl?: string; isActive: boolean; isDefault: boolean;
}

const emptyForm = {
  name: "", address: "", city: "", state: "", zip: "", phone: "", email: "",
  taxRate: "8.25", laborRate: "105", googleReviewUrl: "", isDefault: false,
};

export default function ShopsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: () => axios.get("/api/shops").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => axios.post("/api/shops", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shops"] }); setShowAdd(false); setForm(emptyForm); },
  });

  const updateMutation = useMutation({
    mutationFn: () => axios.patch(`/api/shops/${editing!.id}`, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shops"] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/shops/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shops"] }),
  });

  const openEdit = (shop: Shop) => {
    setEditing(shop);
    setForm({
      name: shop.name, address: shop.address || "", city: shop.city || "",
      state: shop.state || "", zip: shop.zip || "", phone: shop.phone || "",
      email: shop.email || "", taxRate: String(shop.taxRate * 100 || "8.25"),
      laborRate: String(shop.laborRate || "105"), googleReviewUrl: shop.googleReviewUrl || "",
      isDefault: shop.isDefault,
    });
  };

  const isOpen = showAdd || !!editing;
  const onClose = () => { setShowAdd(false); setEditing(null); setForm(emptyForm); };
  const onSubmit = () => editing ? updateMutation.mutate() : createMutation.mutate();
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="h-6 w-6 text-indigo-600" /> Shops & Locations</h1>
          <p className="text-sm text-gray-500">Manage your shop locations, labor rates, and tax rates</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4 mr-2" /> Add Shop</Button>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-500">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shops.map(shop => (
            <Card key={shop.id} className={`${shop.isDefault ? "border-indigo-400 bg-indigo-50/40" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {shop.name}
                    {shop.isDefault && <Badge className="bg-indigo-100 text-indigo-700 text-xs">Default</Badge>}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(shop)}><Edit className="h-4 w-4" /></Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {shop.address && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{shop.address}, {shop.city}, {shop.state} {shop.zip}</span>
                  </div>
                )}
                {shop.phone && <div className="flex items-center gap-2 text-gray-600"><Phone className="h-3 w-3" />{shop.phone}</div>}
                {shop.email && <div className="flex items-center gap-2 text-gray-600"><Mail className="h-3 w-3" />{shop.email}</div>}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-gray-100 rounded p-2">
                    <p className="text-xs text-gray-500">Labor Rate</p>
                    <p className="font-bold">{formatCurrency(shop.laborRate)}/hr</p>
                  </div>
                  <div className="bg-gray-100 rounded p-2">
                    <p className="text-xs text-gray-500">Tax Rate</p>
                    <p className="font-bold">{(Number(shop.taxRate) * 100).toFixed(2)}%</p>
                  </div>
                </div>
                {shop.googleReviewUrl && (
                  <a href={shop.googleReviewUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-yellow-600 hover:underline mt-1">
                    <Star className="h-3 w-3" /> Google Review Link
                  </a>
                )}
                {!shop.isDefault && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => updateMutation.mutate()}>Set Default</Button>
                    <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50" onClick={() => deleteMutation.mutate(shop.id)}>Remove</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {shops.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="p-12 text-center text-gray-400">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No shops yet</p>
                <p className="text-sm mt-1">Add your first location to enable multi-shop features</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Shop" : "Add Shop"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Shop Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="B&V Mobile Auto - Main" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="TX" maxLength={2} /></div>
              <div className="space-y-1"><Label>ZIP</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Labor Rate ($/hr)</Label>
              <Input type="number" value={form.laborRate} onChange={e => setForm({ ...form, laborRate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Tax Rate (%)</Label>
              <Input type="number" step="0.01" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: e.target.value })} placeholder="8.25" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Google Review URL</Label>
              <Input value={form.googleReviewUrl} onChange={e => setForm({ ...form, googleReviewUrl: e.target.value })} placeholder="https://g.page/r/..." />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} />
              <Label htmlFor="isDefault" className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-indigo-600" /> Set as default shop</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={onSubmit} disabled={!form.name || isPending}>
              {isPending ? "Saving..." : editing ? "Update Shop" : "Add Shop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
