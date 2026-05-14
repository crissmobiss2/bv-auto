"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, ShoppingCart, CheckCircle, XCircle, Loader2, Zap, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PartResult {
  supplier: string; partNumber: string; description: string; brand: string;
  price: number; coreCharge: number; inStock: boolean; stockQty: number;
  location: string; condition: string; warranty: string;
}

const SUPPLIER_COLORS: Record<string, string> = {
  "NAPA Auto Parts": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Worldpac": "bg-blue-100 text-blue-800 border-blue-200",
  "O'Reilly Auto Parts": "bg-red-100 text-red-800 border-red-200",
};

export default function PartsSearchPage() {
  const [form, setForm] = useState({ year: "", make: "", model: "", q: "" });
  const [results, setResults] = useState<PartResult[]>([]);
  const [cartItems, setCartItems] = useState<PartResult[]>([]);
  const [note, setNote] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [orderDone, setOrderDone] = useState(false);

  // Fetch open jobs so tech can attach parts order to a job
  const { data: jobsData } = useQuery({
    queryKey: ["open-jobs-for-parts"],
    queryFn: () =>
      axios.get("/api/jobs?status=SCHEDULED,IN_PROGRESS,PARTS_WAITING,PENDING_APPROVAL&limit=50").then(r => r.data),
  });
  const jobs: { id: string; jobNumber: string; title: string; customer: { firstName: string; lastName: string } }[] =
    jobsData?.jobs || [];

  const searchMutation = useMutation({
    mutationFn: () => {
      const p = new URLSearchParams({ q: form.q });
      if (form.year) p.set("year", form.year);
      if (form.make) p.set("make", form.make);
      if (form.model) p.set("model", form.model);
      return axios.get(`/api/parts-search?${p}`).then(r => r.data);
    },
    onSuccess: (data) => {
      setResults(data.results || []);
      setNote(data.note || "");
    },
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobId) throw new Error("Select a job first");
      // Create a JobPart record for each item in the cart
      await Promise.all(
        cartItems.map((part) =>
          axios.post("/api/parts", {
            jobId: selectedJobId,
            partNumber: part.partNumber,
            description: `${part.description}${part.brand ? ` (${part.brand})` : ""}`,
            unitCost: part.price,
            markup: 0,
            quantity: 1,
            coreCharge: part.coreCharge || undefined,
            notes: [
              `Supplier: ${part.supplier}`,
              part.condition ? `Condition: ${part.condition}` : "",
              part.warranty ? `Warranty: ${part.warranty}` : "",
              part.inStock ? `In stock (${part.stockQty})` : "Out of stock",
            ].filter(Boolean).join(" · "),
          })
        )
      );
    },
    onSuccess: () => {
      setCartItems([]);
      setSelectedJobId("");
      setOrderDone(true);
      setTimeout(() => setOrderDone(false), 4000);
    },
  });

  const addToCart = (part: PartResult) => {
    if (!cartItems.find(c => c.partNumber === part.partNumber && c.supplier === part.supplier)) {
      setCartItems([...cartItems, part]);
    }
  };

  const removeFromCart = (part: PartResult) => {
    setCartItems(cartItems.filter(c => !(c.partNumber === part.partNumber && c.supplier === part.supplier)));
  };

  const cartTotal = cartItems.reduce((s, p) => s + p.price + (p.coreCharge || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-green-600" /> Live Parts Search</h1>
        <p className="text-sm text-gray-500">Search NAPA, Worldpac, and O'Reilly simultaneously — AI-powered catalog</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input placeholder="2020" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Make</Label>
              <Input placeholder="Toyota" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <Input placeholder="Camry" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Part Name or Number *</Label>
              <Input
                placeholder="e.g. front brake pads, oil filter, alternator, P01234..."
                value={form.q}
                onChange={e => setForm({ ...form, q: e.target.value })}
                onKeyDown={e => e.key === "Enter" && form.q && searchMutation.mutate()}
              />
            </div>
            <div className="flex items-end">
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => searchMutation.mutate()} disabled={!form.q || searchMutation.isPending}>
                {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">{searchMutation.isPending ? "Searching..." : "Search All Suppliers"}</span>
              </Button>
            </div>
          </div>
          {note && (
            <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              <Zap className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{note}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Results */}
        <div className="lg:col-span-2 space-y-3">
          {searchMutation.isPending && (
            <div className="p-12 text-center text-green-600 border-2 border-green-200 rounded-lg bg-green-50">
              <Loader2 className="h-10 w-10 mx-auto animate-spin mb-2" />
              <p className="font-medium">Searching all suppliers...</p>
            </div>
          )}

          {!searchMutation.isPending && results.length === 0 && searchMutation.isSuccess && (
            <Card><CardContent className="p-8 text-center text-gray-500">No parts found. Try a different search term.</CardContent></Card>
          )}

          {searchMutation.isIdle && (
            <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Search for a part to see results</p>
              <p className="text-sm mt-1">Results from NAPA, Worldpac, and O'Reilly will appear here</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 font-medium">{results.length} results across {new Set(results.map(r => r.supplier)).size} suppliers</p>
              {results.map((part, i) => {
                const inCart = cartItems.some(c => c.partNumber === part.partNumber && c.supplier === part.supplier);
                return (
                  <Card key={i} className={`transition-all ${inCart ? "border-green-300 bg-green-50" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge className={`text-xs ${SUPPLIER_COLORS[part.supplier] || "bg-gray-100 text-gray-700"}`}>{part.supplier}</Badge>
                            <span className="font-mono text-sm font-bold">{part.partNumber}</span>
                            <span className="text-sm text-gray-600">{part.brand}</span>
                          </div>
                          <p className="font-medium text-gray-900">{part.description}</p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span className={`flex items-center gap-1 ${part.inStock ? "text-green-600" : "text-red-500"}`}>
                              {part.inStock ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              {part.inStock ? `In Stock (${part.stockQty})` : "Out of Stock"}
                            </span>
                            <span>{part.condition}</span>
                            <span>{part.warranty}</span>
                            {part.location && <span>📍 {part.location}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(part.price)}</p>
                          {part.coreCharge > 0 && <p className="text-xs text-gray-500">+{formatCurrency(part.coreCharge)} core</p>}
                          <Button
                            size="sm"
                            className={`mt-2 ${inCart ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
                            onClick={() => inCart ? removeFromCart(part) : addToCart(part)}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            {inCart ? "Remove" : "Add to Order"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div>
          <Card className="sticky top-4">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Order Cart ({cartItems.length})</CardTitle></CardHeader>
            <CardContent>
              {orderDone && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <Check className="h-4 w-4" /> Parts added to job successfully.
                </div>
              )}
              {cartItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No parts selected</p>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((part, i) => (
                    <div key={i} className="flex justify-between text-sm border-b pb-2 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-gray-500">{part.partNumber}</p>
                        <p className="truncate font-medium">{part.description}</p>
                        <Badge className={`text-xs mt-0.5 ${SUPPLIER_COLORS[part.supplier] || ""}`}>{part.supplier}</Badge>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold">{formatCurrency(part.price)}</p>
                        <button className="text-xs text-red-500 hover:underline" onClick={() => removeFromCart(part)}>remove</button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Attach to Job *</Label>
                    <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a job..." />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs.map(job => (
                          <SelectItem key={job.id} value={job.id}>
                            #{job.jobNumber} — {job.title} ({job.customer.firstName} {job.customer.lastName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {orderMutation.isError && (
                    <p className="text-xs text-red-600">{(orderMutation.error as Error).message}</p>
                  )}

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => orderMutation.mutate()}
                    disabled={!selectedJobId || orderMutation.isPending}
                  >
                    {orderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {selectedJobId ? "Add Parts to Job" : "Select a Job First"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
