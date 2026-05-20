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
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus, Search, Phone, Mail, DollarSign, Truck, AlertCircle } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface FleetAccount {
  id: string; name: string; contactName?: string; email?: string; phone?: string;
  billingTerms: string; poRequired: boolean; customLaborRate?: number;
  creditLimit?: number; jobCount: number; openBalance: number; isActive: boolean;
}

const BILLING_TERMS = ["NET_7", "NET_15", "NET_30", "NET_45", "NET_60", "COD", "PREPAID"];

export default function FleetPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", contactName: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
    billingTerms: "NET_30", customLaborRate: "", poRequired: false, creditLimit: "", notes: "",
  });

  const { data: accounts = [], isLoading } = useQuery<FleetAccount[]>({
    queryKey: ["fleet", search],
    queryFn: () => axios.get(`/api/fleet?q=${search}`).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => axios.post("/api/fleet", {
      ...form,
      customLaborRate: form.customLaborRate ? Number(form.customLaborRate) : null,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet"] });
      setShowAdd(false);
      setForm({ name: "", contactName: "", email: "", phone: "", address: "", city: "", state: "", zip: "", billingTerms: "NET_30", customLaborRate: "", poRequired: false, creditLimit: "", notes: "" });
    },
  });

  const totalOpenAR = accounts.reduce((s, a) => s + a.openBalance, 0);
  const totalAccounts = accounts.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="h-6 w-6 text-blue-600" /> Fleet Accounts</h1>
          <p className="text-sm text-gray-500">{totalAccounts} accounts · {formatCurrency(totalOpenAR)} open AR</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> New Fleet Account</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Fleet Accounts</p>
          <p className="text-2xl font-bold text-gray-900">{totalAccounts}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Open A/R Balance</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOpenAR)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Fleet Jobs</p>
          <p className="text-2xl font-bold text-blue-600">{accounts.reduce((s, a) => s + a.jobCount, 0)}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input className="pl-9" placeholder="Search fleet accounts..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Account list */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : accounts.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-gray-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No fleet accounts yet</p>
          <p className="text-sm mt-1">Add your first fleet customer to get started</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/fleet/${account.id}`} className="font-bold text-blue-700 hover:underline text-lg">
                        {account.name}
                      </Link>
                      <Badge variant="outline" className="text-xs">{account.billingTerms.replace("_", " ")}</Badge>
                      {account.poRequired && <Badge className="bg-orange-100 text-orange-700 text-xs">PO Required</Badge>}
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600 flex-wrap">
                      {account.contactName && <span>{account.contactName}</span>}
                      {account.phone && <a href={`tel:${account.phone}`} className="flex items-center gap-1 hover:text-blue-600"><Phone className="h-3 w-3" />{account.phone}</a>}
                      {account.email && <a href={`mailto:${account.email}`} className="flex items-center gap-1 hover:text-blue-600"><Mail className="h-3 w-3" />{account.email}</a>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Open Balance</p>
                        <p className={`font-bold ${account.openBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(account.openBalance)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total Jobs</p>
                        <p className="font-bold text-gray-800">{account.jobCount}</p>
                      </div>
                    </div>
                    {account.customLaborRate && (
                      <p className="text-xs text-gray-400">Custom rate: {formatCurrency(account.customLaborRate)}/hr</p>
                    )}
                    {account.creditLimit && account.openBalance > Number(account.creditLimit) * 0.8 && (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3" /> Near credit limit
                      </div>
                    )}
                    <Link href={`/fleet/${account.id}`}>
                      <Button size="sm" variant="outline">View Account</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Fleet Account</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Company Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ABC Transportation LLC" />
            </div>
            <div className="space-y-1">
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} placeholder="John Smith" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 555-5555" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="billing@company.com" />
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
              <div className="space-y-1">
                <Label>State</Label>
                <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="TX" maxLength={2} />
              </div>
              <div className="space-y-1">
                <Label>ZIP</Label>
                <Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Billing Terms</Label>
              <select className="w-full border rounded-md h-10 px-3 text-sm" value={form.billingTerms} onChange={e => setForm({ ...form, billingTerms: e.target.value })}>
                {BILLING_TERMS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Custom Labor Rate ($/hr)</Label>
              <Input type="number" value={form.customLaborRate} onChange={e => setForm({ ...form, customLaborRate: e.target.value })} placeholder="Leave blank for standard rate" />
            </div>
            <div className="space-y-1">
              <Label>Credit Limit ($)</Label>
              <Input type="number" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: e.target.value })} placeholder="No limit" />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="poRequired" checked={form.poRequired} onChange={e => setForm({ ...form, poRequired: e.target.checked })} />
              <Label htmlFor="poRequired">Require PO number on all jobs</Label>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Account notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Fleet Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
