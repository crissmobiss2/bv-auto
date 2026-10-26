"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, DollarSign, ClipboardCopy, ExternalLink, ChevronDown, ChevronRight, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { formatCurrency, PART_STATUS_COLORS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

const PART_STATUSES = ["REQUESTED", "QUOTED", "ORDERED", "SHIPPED", "PICKED_UP", "RECEIVED", "INSTALLED", "RETURNED", "CREDITED", "CANCELLED"];
const PO_STATUSES = ["DRAFT", "SENT", "CONFIRMED", "RECEIVED", "CANCELLED"];
const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-purple-100 text-purple-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};
const OPEN_PART_STATUSES = ["REQUESTED", "QUOTED"];

type Part = {
  id: string;
  description: string;
  partNumber?: string;
  quantity: number;
  unitCost?: number;
  unitPrice?: number;
  status: string;
  totalPrice?: number;
  vendor?: { name: string } | null;
  job: { id: string; jobNumber: string; customer: { firstName: string; lastName: string } };
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  notes?: string | null;
  estimatedTotal: number;
  orderedAt?: string | null;
  expectedAt?: string | null;
  receivedAt?: string | null;
  vendor: { id: string; name: string; phone?: string; email?: string; website?: string };
  items: { id: string; description: string; partNumber?: string; quantity: number; unitCost?: number; status: string; job?: { id: string; jobNumber: string; customer: { firstName: string; lastName: string } } }[];
};

export default function PartsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showVendor, setShowVendor] = useState(false);
  const emptyVendor = { name: "", contactName: "", phone: "", email: "", address: "", city: "", state: "", zip: "", accountNum: "", website: "" };
  const [vendorForm, setVendorForm] = useState(emptyVendor);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);

  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({ vendorId: "", expectedAt: "", notes: "" });
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [poError, setPoError] = useState("");

  const { data: parts, isLoading } = useQuery({
    queryKey: ["all-parts", statusFilter],
    queryFn: () =>
      axios.get(`/api/parts${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`)
        .then((r) => r.data),
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => axios.get("/api/vendors").then((r) => r.data),
  });

  const { data: marginData } = useQuery({
    queryKey: ["parts-margin"],
    queryFn: () => axios.get("/api/parts/margin").then((r) => r.data),
  });

  const { data: purchaseOrders } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => axios.get("/api/purchase-orders").then((r) => r.data),
  });

  const saveVendorMutation = useMutation({
    mutationFn: () => editingVendor
      ? axios.patch(`/api/vendors/${editingVendor}`, vendorForm)
      : axios.post("/api/vendors", vendorForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setShowVendor(false);
      setEditingVendor(null);
      setVendorForm(emptyVendor);
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/vendors/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });

  const openEditVendor = (v: { id: string; name: string; contactName?: string; phone?: string; email?: string; accountNum?: string; website?: string }) => {
    setEditingVendor(v.id);
    setVendorForm({ ...emptyVendor, name: v.name, contactName: v.contactName || "", phone: v.phone || "", email: v.email || "", accountNum: v.accountNum || "", website: v.website || "" });
    setShowVendor(true);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => axios.patch(`/api/parts/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-parts"] }),
  });

  const createPOMutation = useMutation({
    mutationFn: () =>
      axios.post("/api/purchase-orders", {
        vendorId: orderForm.vendorId,
        partIds: Array.from(selectedParts),
        expectedAt: orderForm.expectedAt || undefined,
        notes: orderForm.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-parts"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setShowOrderDialog(false);
      setSelectedParts(new Set());
      setOrderForm({ vendorId: "", expectedAt: "", notes: "" });
      setPoError("");
    },
    onError: (e: unknown) => {
      setPoError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create order");
    },
  });

  const poStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => axios.patch(`/api/purchase-orders/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-parts"] });
    },
  });

  const togglePart = (id: string) => {
    setSelectedParts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { data: shopInfo } = useQuery({
    queryKey: ["shop-info"],
    queryFn: () => axios.get("/api/shop-info").then((r) => r.data as { name?: string }),
    staleTime: 10 * 60_000,
  });

  const buildOrderText = (po: PurchaseOrder) => {
    const lines = [
      `Purchase Order ${po.poNumber} — ${po.vendor.name}`,
      ...(shopInfo?.name ? [`From: ${shopInfo.name}`] : []),
      "",
      ...po.items.map((i) => `• ${Number(i.quantity)} × ${i.description}${i.partNumber ? ` (PN: ${i.partNumber})` : ""}`),
      "",
      po.notes ? `Notes: ${po.notes}` : "",
      `Estimated total: ${formatCurrency(Number(po.estimatedTotal))}`,
      "Please confirm availability and ETA. Thank you!",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const copyOrder = async (po: PurchaseOrder) => {
    try {
      await navigator.clipboard.writeText(buildOrderText(po));
      toast("Order list copied — paste it into a text or email to the vendor.");
    } catch {
      // clipboard may be blocked; fall back to a printable window
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<pre style="font-family:monospace;font-size:14px;white-space:pre-wrap">${buildOrderText(po).replace(/</g, "&lt;")}</pre>`);
        w.document.close();
      }
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Parts</h1>

      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts">Active Parts</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders ({purchaseOrders?.length || 0})</TabsTrigger>
          <TabsTrigger value="vendors">Vendors ({vendors?.length || 0})</TabsTrigger>
          <TabsTrigger value="margin">Margin Tracker</TabsTrigger>
        </TabsList>

        <TabsContent value="parts" className="mt-4 space-y-4">
          <div className="flex gap-3 items-center flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {PART_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedParts.size > 0 && (
              <Button
                onClick={() => { setPoError(""); setOrderForm((f) => ({ ...f, vendorId: f.vendorId || "" })); setShowOrderDialog(true); }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create Purchase Order ({selectedParts.size})
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-center text-gray-500">Loading...</p>
              ) : !parts?.length ? (
                <p className="p-6 text-center text-gray-500">No parts found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Part</TableHead>
                      <TableHead className="hidden sm:table-cell">Job</TableHead>
                      <TableHead className="hidden md:table-cell">Vendor</TableHead>
                      <TableHead className="hidden lg:table-cell">Price</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((part: Part) => (
                      <TableRow key={part.id}>
                        <TableCell>
                          {OPEN_PART_STATUSES.includes(part.status) ? (
                            <input
                              type="checkbox"
                              checked={selectedParts.has(part.id)}
                              onChange={() => togglePart(part.id)}
                              className="h-4 w-4 cursor-pointer"
                              title="Select to order"
                            />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{part.description}</p>
                          {part.partNumber && <p className="text-xs text-gray-400 font-mono">{part.partNumber}</p>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Link href={`/jobs/${part.job.id}`} className="text-blue-600 hover:underline text-sm">
                            {part.job.jobNumber}
                          </Link>
                          <p className="text-xs text-gray-500">{`${part.job.customer.firstName} ${part.job.customer.lastName}`}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-gray-500">
                          {part.vendor?.name || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {part.totalPrice ? formatCurrency(part.totalPrice) : "—"}
                        </TableCell>
                        <TableCell>
                          <Select value={part.status} onValueChange={(v) => statusMutation.mutate({ id: part.id, status: v })}>
                            <SelectTrigger className={`w-36 text-xs h-8 ${PART_STATUS_COLORS[part.status]}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PART_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-4">
          {!purchaseOrders?.length ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <p className="font-medium">No purchase orders yet</p>
                <p className="text-sm mt-1">Select open parts on the Active Parts tab, then click &ldquo;Create Purchase Order&rdquo;.</p>
              </CardContent>
            </Card>
          ) : (
            purchaseOrders.map((po: PurchaseOrder) => (
              <Card key={po.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      className="flex items-center gap-2 text-left"
                      onClick={() => setExpandedPO(expandedPO === po.id ? null : po.id)}
                    >
                      {expandedPO === po.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <CardTitle className="text-base">{po.poNumber}</CardTitle>
                        <p className="text-xs text-gray-500">
                          {po.vendor.name} · {po.items.length} item{po.items.length === 1 ? "" : "s"} · {formatCurrency(Number(po.estimatedTotal))}
                          {po.orderedAt ? ` · ordered ${new Date(po.orderedAt).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge className={PO_STATUS_COLORS[po.status]}>{po.status}</Badge>
                      <Select value={po.status} onValueChange={(v) => poStatusMutation.mutate({ id: po.id, status: v })}>
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                {expandedPO === po.id && (
                  <CardContent className="pt-0 space-y-3">
                    <div className="border rounded divide-y text-sm">
                      {po.items.map((i) => (
                        <div key={i.id} className="flex items-center justify-between px-3 py-2">
                          <div>
                            <p className="font-medium">{Number(i.quantity)} × {i.description}</p>
                            <p className="text-xs text-gray-400">
                              {i.partNumber && <span className="font-mono mr-2">{i.partNumber}</span>}
                              {i.job && (
                                <Link href={`/jobs/${i.job.id}`} className="text-blue-600 hover:underline">
                                  {i.job.jobNumber} — {i.job.customer.firstName} {i.job.customer.lastName}
                                </Link>
                              )}
                            </p>
                          </div>
                          <span className="text-gray-500 text-xs">{i.status.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                    {po.notes && <p className="text-sm text-gray-500">Notes: {po.notes}</p>}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => copyOrder(po)}>
                        <ClipboardCopy className="h-3 w-3 mr-1" /> Copy Order List
                      </Button>
                      {po.vendor.website && /^https?:\/\//i.test(po.vendor.website) && (
                        <a href={po.vendor.website} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            <ExternalLink className="h-3 w-3 mr-1" /> {po.vendor.name} Portal
                          </Button>
                        </a>
                      )}
                      {po.vendor.phone && (
                        <a href={`tel:${po.vendor.phone}`}>
                          <Button size="sm" variant="outline">Call {po.vendor.name}</Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="vendors" className="mt-4 space-y-4">
          <Button onClick={() => { setEditingVendor(null); setVendorForm(emptyVendor); setShowVendor(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Vendor
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors?.map((v: { id: string; name: string; contactName?: string; phone?: string; email?: string; accountNum?: string; website?: string }) => (
              <Card key={v.id}>
                <CardContent className="p-4 text-sm space-y-1">
                  <p className="font-semibold text-base">{v.name}</p>
                  {v.contactName && <p className="text-gray-600">{v.contactName}</p>}
                  {v.phone && <a href={`tel:${v.phone}`} className="text-blue-600">{v.phone}</a>}
                  {v.email && <p className="text-gray-500">{v.email}</p>}
                  {v.accountNum && <p className="text-gray-400 text-xs">Acct: {v.accountNum}</p>}
                  {v.website && /^https?:\/\//i.test(v.website) && <a href={v.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs block">Ordering portal ↗</a>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => openEditVendor(v)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button type="button" onClick={() => { if (confirm(`Remove vendor ${v.name}?`)) deleteVendorMutation.mutate(v.id); }} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="margin" className="mt-4 space-y-4">
          {!marginData?.summary ? (
            <Card><CardContent className="p-8 text-center text-gray-400">No parts data available yet.</CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Parts Revenue (30d)", value: formatCurrency(marginData.summary.totalRevenue), icon: DollarSign, color: "text-blue-600 bg-blue-50" },
                  { label: "Parts Cost (30d)", value: formatCurrency(marginData.summary.totalCost), icon: TrendingDown, color: "text-red-600 bg-red-50" },
                  { label: "Parts Profit (30d)", value: formatCurrency(marginData.summary.totalProfit), icon: TrendingUp, color: "text-green-600 bg-green-50" },
                  { label: "Avg Margin %", value: `${marginData.summary.avgMarginPct}%`, icon: TrendingUp, color: marginData.summary.avgMarginPct >= 30 ? "text-green-600 bg-green-50" : "text-yellow-600 bg-yellow-50" },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
                      <div>
                        <p className="text-xl font-bold">{s.value}</p>
                        <p className="text-xs text-gray-500">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" /> Highest Margin Parts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {marginData.topMargin.slice(0, 8).map((p: { id: string; description: string; marginPct: number; profit: number; vendor?: { name: string } | null }) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.description}</p>
                          <p className="text-xs text-gray-400">{p.vendor?.name || "No vendor"} · {formatCurrency(p.profit)} profit</p>
                        </div>
                        <Badge className="bg-green-100 text-green-700 ml-2">{p.marginPct}%</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Lowest Margin Parts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {marginData.lowMargin.slice(0, 8).map((p: { id: string; description: string; marginPct: number; profit: number; vendor?: { name: string } | null }) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.description}</p>
                          <p className="text-xs text-gray-400">{p.vendor?.name || "No vendor"} · {formatCurrency(p.profit)} profit</p>
                        </div>
                        <Badge className={`ml-2 ${p.marginPct < 15 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{p.marginPct}%</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {marginData.byVendor?.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader><CardTitle className="text-sm">Margin by Vendor</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {marginData.byVendor.map((v: { name: string; revenue: number; cost: number; count: number; marginPct: number }) => (
                          <div key={v.name}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{v.name}</span>
                              <span className="text-gray-500">{formatCurrency(v.revenue)} rev · {v.count} parts · <span className={`font-bold ${v.marginPct >= 30 ? "text-green-600" : v.marginPct >= 15 ? "text-yellow-600" : "text-red-600"}`}>{v.marginPct}%</span></span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-2 rounded-full ${v.marginPct >= 30 ? "bg-green-500" : v.marginPct >= 15 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${Math.min(v.marginPct, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Purchase Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{selectedParts.size} part{selectedParts.size === 1 ? "" : "s"} selected</p>
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Select value={orderForm.vendorId} onValueChange={(v) => setOrderForm({ ...orderForm, vendorId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a vendor..." /></SelectTrigger>
                <SelectContent>
                  {vendors?.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vendors?.length === 0 && (
                <p className="text-xs text-orange-600">No vendors yet — add one in the Vendors tab first.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery</Label>
              <Input type="date" value={orderForm.expectedAt} onChange={(e) => setOrderForm({ ...orderForm, expectedAt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="e.g. need by Friday for brake job"
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
              />
            </div>
            {poError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{poError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>Cancel</Button>
            <Button onClick={() => createPOMutation.mutate()} disabled={!orderForm.vendorId || createPOMutation.isPending}>
              {createPOMutation.isPending ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVendor} onOpenChange={setShowVendor}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Name *", key: "name", col: 2 },
              { label: "Contact Name", key: "contactName" },
              { label: "Phone", key: "phone" },
              { label: "Email", key: "email" },
              { label: "Account #", key: "accountNum" },
              { label: "Ordering Portal URL", key: "website", col: 2 },
              { label: "Address", key: "address", col: 2 },
              { label: "City", key: "city" },
              { label: "State", key: "state" },
            ].map(({ label, key, col }) => (
              <div key={key} className={`space-y-2 ${col === 2 ? "col-span-2" : ""}`}>
                <Label>{label}</Label>
                <Input value={(vendorForm as Record<string, string>)[key]} onChange={(e) => setVendorForm({ ...vendorForm, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVendor(false)}>Cancel</Button>
            <Button onClick={() => saveVendorMutation.mutate()} disabled={!vendorForm.name || saveVendorMutation.isPending}>
              {saveVendorMutation.isPending ? "Saving..." : editingVendor ? "Save Vendor" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}