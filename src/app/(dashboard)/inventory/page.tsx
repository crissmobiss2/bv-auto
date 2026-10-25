"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Package, Search, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface InventoryItem {
  id: string; name: string; partNumber?: string; description?: string;
  category?: string; quantityOnHand: number; reorderPoint: number;
  unitCost: number; location?: string; notes?: string;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [_editItem, _setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({
    name: "", partNumber: "", description: "", category: "",
    quantityOnHand: "0", reorderPoint: "2", unitCost: "0", location: "", notes: "",
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory", search, showLowStock],
    queryFn: () => axios.get(`/api/inventory?q=${search}&lowStock=${showLowStock}`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => axios.post("/api/inventory", {
      ...form,
      quantityOnHand: parseInt(form.quantityOnHand),
      reorderPoint: parseInt(form.reorderPoint),
      unitCost: parseFloat(form.unitCost),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setShowAdd(false);
      setForm({ name: "", partNumber: "", description: "", category: "", quantityOnHand: "0", reorderPoint: "2", unitCost: "0", location: "", notes: "" });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, adjustment }: { id: string; adjustment: number }) =>
      axios.patch(`/api/inventory/${id}`, { adjustment }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements", v.id] });
    },
    onError: (e) => alert((axios.isAxiosError(e) && e.response?.data?.error) || "Stock change failed"),
  });
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const lowStockCount = (items || []).filter((i: InventoryItem) => i.quantityOnHand <= i.reorderPoint).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={showLowStock ? "default" : "outline"}
          onClick={() => setShowLowStock(!showLowStock)}
          className="flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          Low Stock {lowStockCount > 0 && <Badge className="bg-red-500 text-white ml-1">{lowStockCount}</Badge>}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : (items || []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No inventory items yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(items || []).map((item: InventoryItem) => {
            const isLow = item.quantityOnHand <= item.reorderPoint;
            return (
              <Card key={item.id} className={isLow ? "border-red-200" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{item.name}</p>
                        {item.partNumber && <span className="text-xs text-gray-400 font-mono">{item.partNumber}</span>}
                        {isLow && <Badge className="bg-red-100 text-red-700 text-xs">Low Stock</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                        {item.category && <span>{item.category}</span>}
                        {item.location && <span>📍 {item.location}</span>}
                        <span>Cost: {formatCurrency(item.unitCost)}</span>
                        <span>Reorder at: {item.reorderPoint}</span>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => adjustMutation.mutate({ id: item.id, adjustment: -1 })}
                        disabled={item.quantityOnHand <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className={`text-lg font-bold w-8 text-center ${isLow ? "text-red-600" : "text-gray-900"}`}>
                        {item.quantityOnHand}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => adjustMutation.mutate({ id: item.id, adjustment: 1 })}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setHistoryFor(historyFor === item.id ? null : item.id)}>
                        History
                      </Button>
                    </div>
                  </div>
                  {historyFor === item.id && <StockHistory itemId={item.id} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Name *", key: "name", span: true },
              { label: "Part Number", key: "partNumber" },
              { label: "Category", key: "category" },
              { label: "Location (truck/shop)", key: "location" },
              { label: "Qty on Hand", key: "quantityOnHand", type: "number" },
              { label: "Reorder Point", key: "reorderPoint", type: "number" },
              { label: "Unit Cost ($)", key: "unitCost", type: "number" },
            ].map(({ label, key, type, span }) => (
              <div key={key} className={`space-y-2 ${span ? "col-span-2" : ""}`}>
                <Label>{label}</Label>
                <Input
                  type={type || "text"}
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StockHistory({ itemId }: { itemId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-movements", itemId],
    queryFn: () => axios.get(`/api/inventory/${itemId}/movements`).then((r) => r.data),
  });
  if (isLoading) return <p className="mt-3 text-xs text-gray-500">Loading history…</p>;
  const rows = (data || []) as { id: string; type: string; quantity: number; balanceAfter: number; reason?: string; createdAt: string }[];
  if (rows.length === 0) return <p className="mt-3 text-xs text-gray-500">No stock movements recorded yet.</p>;
  return (
    <ul className="mt-3 divide-y border-t text-xs">
      {rows.map((m) => (
        <li key={m.id} className="flex justify-between py-1.5">
          <span>
            <span className="font-medium">{m.type}</span> {m.reason && <span className="text-gray-500">· {m.reason}</span>}
            <span className="block text-gray-400">{new Date(m.createdAt).toLocaleString()}</span>
          </span>
          <span className="text-right">
            <span className={m.quantity < 0 ? "text-red-600" : "text-green-600"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>
            <span className="block text-gray-400">on hand {m.balanceAfter}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
