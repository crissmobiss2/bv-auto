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
import { Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import Link from "next/link";
import { formatCurrency, PART_STATUS_COLORS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PART_STATUSES = ["REQUESTED", "QUOTED", "ORDERED", "SHIPPED", "PICKED_UP", "RECEIVED", "INSTALLED", "RETURNED", "CREDITED", "CANCELLED"];

export default function PartsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showVendor, setShowVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "", city: "", state: "", zip: "", accountNum: "" });

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

  const addVendorMutation = useMutation({
    mutationFn: () => axios.post("/api/vendors", vendorForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setShowVendor(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => axios.patch(`/api/parts/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-parts"] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Parts</h1>

      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts">Active Parts</TabsTrigger>
          <TabsTrigger value="vendors">Vendors ({vendors?.length || 0})</TabsTrigger>
          <TabsTrigger value="margin">Margin Tracker</TabsTrigger>
        </TabsList>

        <TabsContent value="parts" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {PART_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
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
                      <TableHead>Part</TableHead>
                      <TableHead className="hidden sm:table-cell">Job</TableHead>
                      <TableHead className="hidden md:table-cell">Vendor</TableHead>
                      <TableHead className="hidden lg:table-cell">Price</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((part: {
                      id: string;
                      description: string;
                      partNumber?: string;
                      status: string;
                      totalPrice?: number;
                      vendor?: { name: string } | null;
                      job: { id: string; jobNumber: string; customer: { firstName: string; lastName: string } };
                    }) => (
                      <TableRow key={part.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{part.description}</p>
                          {part.partNumber && <p className="text-xs text-gray-400 font-mono">{part.partNumber}</p>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Link href={`/jobs/${part.job.id}`} className="text-blue-600 hover:underline text-sm">
                            {part.job.jobNumber}
                          </Link>
                          <p className="text-xs text-gray-500">{part.job.customer.firstName} {part.job.customer.lastName}</p>
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

        <TabsContent value="vendors" className="mt-4 space-y-4">
          <Button onClick={() => setShowVendor(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Vendor
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors?.map((v: { id: string; name: string; contactName?: string; phone?: string; email?: string; accountNum?: string }) => (
              <Card key={v.id}>
                <CardContent className="p-4 text-sm space-y-1">
                  <p className="font-semibold text-base">{v.name}</p>
                  {v.contactName && <p className="text-gray-600">{v.contactName}</p>}
                  {v.phone && <a href={`tel:${v.phone}`} className="text-blue-600">{v.phone}</a>}
                  {v.email && <p className="text-gray-500">{v.email}</p>}
                  {v.accountNum && <p className="text-gray-400 text-xs">Acct: {v.accountNum}</p>}
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

      <Dialog open={showVendor} onOpenChange={setShowVendor}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Name *", key: "name", col: 2 },
              { label: "Contact Name", key: "contactName" },
              { label: "Phone", key: "phone" },
              { label: "Email", key: "email" },
              { label: "Account #", key: "accountNum" },
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
            <Button onClick={() => addVendorMutation.mutate()} disabled={!vendorForm.name || addVendorMutation.isPending}>
              {addVendorMutation.isPending ? "Saving..." : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
