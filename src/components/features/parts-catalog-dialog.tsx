"use client";

import { useState } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, PackageCheck, Plus, Warehouse } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CatalogResult {
  partNumber?: string;
  description: string;
  brand?: string;
  price: number;
  coreCharge?: number | null;
  inStock?: boolean;
  stockQty?: number | null;
  supplier?: string;
  source: "catalog" | "shelf";
  quantityOnHand?: number;
  unitCost?: number;
}

export interface PickedPart {
  description: string;
  partNumber?: string;
  quantity: number;
  unitPrice: number;
  markup: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicle?: { year?: number; make?: string; model?: string } | null;
  defaultMarkup: number;
  onAdd: (parts: PickedPart[]) => void;
}

export function PartsCatalogDialog({ open, onOpenChange, vehicle, defaultMarkup, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<PickedPart[]>([]);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset the dialog contents whenever it opens (adjust state during render,
  // the pattern React recommends over setState-in-effect)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setResults([]);
      setPicked([]);
      setQty({});
      setSearched(false);
      setQuery("");
    }
  }

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const [catalogRes, inventoryRes] = await Promise.allSettled([
        axios.get("/api/parts-search", {
          params: { q, year: vehicle?.year, make: vehicle?.make, model: vehicle?.model },
        }),
        axios.get("/api/inventory", { params: { q } }),
      ]);
      const shelf: CatalogResult[] =
        inventoryRes.status === "fulfilled"
          ? (Array.isArray(inventoryRes.value.data) ? inventoryRes.value.data : inventoryRes.value.data?.items || [])
              .filter((i: { isActive?: boolean }) => i.isActive !== false)
              .map((i: { partNumber?: string; name: string; description?: string; quantityOnHand: number; unitCost?: number }) => ({
                partNumber: i.partNumber,
                description: i.description || i.name,
                price: i.unitCost ?? 0,
                stockQty: i.quantityOnHand,
                source: "shelf" as const,
                quantityOnHand: i.quantityOnHand,
                unitCost: i.unitCost,
              }))
          : [];
      const catalog: CatalogResult[] =
        catalogRes.status === "fulfilled"
          ? (catalogRes.value.data?.results || []).map((r: Record<string, unknown>) => ({
              partNumber: r.partNumber as string | undefined,
              description: (r.description as string) || "",
              brand: r.brand as string | undefined,
              price: Number(r.price ?? 0),
              coreCharge: r.coreCharge as number | null,
              inStock: r.inStock as boolean | undefined,
              stockQty: r.stockQty as number | null,
              supplier: r.supplier as string | undefined,
              source: "catalog" as const,
            }))
          : [];
      setResults([...shelf, ...catalog]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const priceFor = (r: CatalogResult) => {
    const base = r.source === "shelf" ? (r.unitCost ?? r.price) : r.price;
    return Math.round(base * (1 + defaultMarkup / 100) * 100) / 100;
  };

  const toggle = (r: CatalogResult) => {
    const key = `${r.source}-${r.partNumber || r.description}`;
    const q = qty[key] || 1;
    setPicked((prev) => {
      const exists = prev.find((p) => p.partNumber === r.partNumber && p.description === r.description);
      if (exists) return prev.filter((p) => p !== exists);
      return [
        ...prev,
        {
          description: r.brand && !r.description.toLowerCase().includes(r.brand.toLowerCase()) ? `${r.brand} ${r.description}` : r.description,
          partNumber: r.partNumber,
          quantity: q,
          unitPrice: priceFor(r),
          markup: defaultMarkup,
        },
      ];
    });
  };

  const isPicked = (r: CatalogResult) =>
    picked.some((p) => p.partNumber === r.partNumber && p.description === r.description);

  const addPicked = () => {
    if (picked.length === 0) return;
    onAdd(picked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find Parts {vehicle?.year ? `— ${vehicle.year} ${vehicle.make} ${vehicle.model}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. brake pads, oil filter, 4T1BF1FK part number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            autoFocus
          />
          <Button onClick={search} disabled={loading || !query.trim()} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Searches your shelf stock first, then the live parts catalog. Prices include your {defaultMarkup}% parts markup — edit the line after adding if needed.
        </p>

        <div className="space-y-2 min-h-[120px]">
          {loading && (
            <div className="text-center text-gray-500 py-6 text-sm">Searching catalog...</div>
          )}
          {!loading && searched && results.length === 0 && (
            <div className="text-center text-gray-500 py-6 text-sm">
              No parts found. Try a different search term.
            </div>
          )}
          {results.map((r, idx) => {
            const key = `${r.source}-${r.partNumber || r.description}-${idx}`;
            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                  isPicked(r) ? "border-blue-400 bg-blue-50" : "border-gray-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {r.brand ? `${r.brand} — ` : ""}{r.description}
                  </p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
                    {r.partNumber && <span className="font-mono">{r.partNumber}</span>}
                    {r.source === "shelf" ? (
                      <span className="text-green-700 font-medium flex items-center gap-1">
                        <Warehouse className="h-3 w-3" /> On shelf · {r.quantityOnHand} in stock
                      </span>
                    ) : (
                      <>
                        {r.supplier && <span>{r.supplier}</span>}
                        {r.inStock != null && (
                          <span className={r.inStock ? "text-green-600" : "text-orange-600"}>
                            {r.inStock ? `In stock${r.stockQty ? ` (${r.stockQty})` : ""}` : "Check availability"}
                          </span>
                        )}
                      </>
                    )}
                    {r.coreCharge ? <span>Core: {formatCurrency(r.coreCharge)}</span> : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{formatCurrency(priceFor(r))}</p>
                  <p className="text-[10px] text-gray-400">after {defaultMarkup}% markup</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    min="1"
                    value={qty[key] || 1}
                    onChange={(e) => setQty({ ...qty, [key]: parseInt(e.target.value) || 1 })}
                    className="w-16 h-8"
                  />
                  <Button
                    size="sm"
                    variant={isPicked(r) ? "default" : "outline"}
                    onClick={() => toggle(r)}
                  >
                    {isPicked(r) ? <PackageCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-sm text-gray-500">{picked.length} part{picked.length === 1 ? "" : "s"} selected</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={addPicked} disabled={picked.length === 0}>
              Add to Quote
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}