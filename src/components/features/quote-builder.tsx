"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Send, CheckCircle, XCircle, Brain, Loader2 } from "lucide-react";
import { formatCurrency, calculateLineItemTotal } from "@/lib/utils";

const LINE_ITEM_TYPES = ["LABOR", "PART", "FLUID", "SUBLET", "SHOP_SUPPLY", "FEE", "DISCOUNT", "OTHER"];

type LineItem = {
  id?: string;
  type: string;
  description: string;
  partNumber?: string;
  quantity: number;
  unitPrice: number;
  markup?: number;
  discount?: number;
  taxable: boolean;
  total: number;
  notes?: string;
};

type Job = {
  id: string;
  title?: string;
  customerId: string;
  vehicle?: { year: number; make: string; model: string; mileage?: number };
  quote?: {
    id: string;
    quoteNumber: string;
    status: string;
    totalAmount: number;
    subtotal: number;
    taxAmount: number;
    taxRate: number;
    notes?: string;
    lineItems: LineItem[];
  } | null;
};

export function QuoteBuilder({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const quote = job.quote;

  const [items, setItems] = useState<LineItem[]>(
    quote?.lineItems || [{ type: "LABOR", description: "", quantity: 1, unitPrice: 0, taxable: true, total: 0 }]
  );
  const [taxRate, setTaxRate] = useState(quote ? Number(quote.taxRate) : 0);
  const [notes, setNotes] = useState(quote?.notes || "");
  const [editing, setEditing] = useState(!quote);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [shopLaborRate, setShopLaborRate] = useState(105);

  useEffect(() => {
    axios.get("/api/shops/settings").then(({ data }) => {
      setShopLaborRate(data.laborRate || 105);
      // Only set tax rate for new quotes (not yet saved)
      if (!quote) setTaxRate(data.taxRate || 0);
    }).catch(() => {});
  }, [quote]);

  const runAiEstimate = async () => {
    setAiLoading(true); setAiError("");
    try {
      const res = await axios.post("/api/ai/estimate", {
        year: job.vehicle?.year,
        make: job.vehicle?.make,
        model: job.vehicle?.model,
        mileage: job.vehicle?.mileage,
        complaint: job.title || "General service",
        laborRate: shopLaborRate,
      });
      const data = res.data;
      const newItems: LineItem[] = [
        ...(data.laborItems || []).map((l: { description: string; hours: number; unitPrice: number; total: number }) => ({
          type: "LABOR", description: l.description, quantity: l.hours,
          unitPrice: l.unitPrice, taxable: true, total: l.total,
        })),
        ...(data.partItems || []).map((p: { description: string; partNumber?: string; quantity: number; unitPrice: number; total: number }) => ({
          type: "PART", description: p.description, partNumber: p.partNumber,
          quantity: p.quantity, unitPrice: p.unitPrice, taxable: true, total: p.total,
        })),
        ...(data.shopSupplies ? [{
          type: "SHOP_SUPPLY", description: "Shop Supplies", quantity: 1,
          unitPrice: data.shopSupplies, taxable: true, total: data.shopSupplies,
        }] : []),
      ];
      setItems(newItems);
      if (data.notes) setNotes(data.notes);
    } catch (e: unknown) {
      setAiError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "AI estimate failed");
    } finally {
      setAiLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { type: "LABOR", description: "", quantity: 1, unitPrice: 0, taxable: true, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number | boolean) => {
    const updated = [...items];
    (updated[index] as Record<string, unknown>)[field] = value;
    const item = updated[index];
    item.total = calculateLineItemTotal(
      Number(item.quantity),
      Number(item.unitPrice),
      item.markup ? Number(item.markup) : undefined,
      item.discount ? Number(item.discount) : undefined
    );
    setItems(updated);
  };

  const subtotal = items.filter(i => i.type !== "DISCOUNT").reduce((s, i) => s + i.total, 0);
  const taxableAmount = items.filter(i => i.taxable && i.type !== "DISCOUNT").reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  const total = subtotal + taxAmount;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (quote) {
        return axios.patch(`/api/quotes/${quote.id}`, { lineItems: items, taxRate, notes });
      }
      return axios.post("/api/quotes", {
        jobId: job.id,
        customerId: job.customerId,
        lineItems: items,
        taxRate,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", job.id] });
      setEditing(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => axios.patch(`/api/quotes/${quote!.id}`, { status: "APPROVED", approvedBy: "Customer", approvalMethod: "verbal" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", job.id] }),
  });

  const declineMutation = useMutation({
    mutationFn: () => axios.patch(`/api/quotes/${quote!.id}`, { status: "DECLINED" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", job.id] }),
  });

  const sendMutation = useMutation({
    mutationFn: () => axios.post(`/api/quotes/${quote!.id}/send`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["job", job.id] });
      if (res.data.approvalUrl) {
        navigator.clipboard?.writeText(res.data.approvalUrl).catch(() => null);
        alert(`Quote sent! Approval link copied to clipboard:\n${res.data.approvalUrl}`);
      }
    },
  });

  if (quote && !editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">{quote.quoteNumber}</CardTitle>
            <span className={`text-xs rounded-md px-2 py-0.5 font-medium ${
              quote.status === "APPROVED" ? "bg-green-100 text-green-700" :
              quote.status === "DECLINED" ? "bg-red-100 text-red-700" :
              quote.status === "SENT" ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-700"
            }`}>{quote.status}</span>
          </div>
          <div className="flex gap-2">
            {quote.status === "DRAFT" && (
              <Button size="sm" variant="outline" onClick={() => sendMutation.mutate()}>
                <Send className="h-4 w-4 mr-1" /> Send
              </Button>
            )}
            {(quote.status === "DRAFT" || quote.status === "SENT") && (
              <>
                <Button size="sm" variant="outline" className="text-green-600" onClick={() => approveMutation.mutate()}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => declineMutation.mutate()}>
                  <XCircle className="h-4 w-4 mr-1" /> Decline
                </Button>
              </>
            )}
            {quote.status !== "APPROVED" && quote.status !== "CONVERTED" && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {quote.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                <div>
                  <span className="font-medium">{li.description}</span>
                  <span className="text-gray-400 text-xs ml-2">{li.type}</span>
                </div>
                <span>{formatCurrency(li.total)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(quote.subtotal)}</span></div>
            {Number(quote.taxAmount) > 0 && (
              <div className="flex justify-between text-gray-600"><span>Tax ({Number(quote.taxRate)}%)</span><span>{formatCurrency(quote.taxAmount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
              <span>Total</span><span>{formatCurrency(quote.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{quote ? "Edit Quote" : "Build Quote"}</CardTitle>
        {quote && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Line Items */}
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2">
                <Select value={item.type} onValueChange={(v) => updateItem(i, "type", v)}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LINE_ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4">
                <Input
                  className="h-8 text-sm"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <Input
                  className="h-8 text-sm"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  className="h-8 text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit $"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-1">
                <Input
                  className="h-8 text-sm"
                  type="number"
                  min="0"
                  placeholder="Markup%"
                  value={item.markup || ""}
                  onChange={(e) => updateItem(i, "markup", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-1 text-right text-sm font-medium py-1">
                {formatCurrency(item.total)}
              </div>
              <div className="col-span-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> Add Line Item
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={runAiEstimate}
            disabled={aiLoading}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />}
            AI Smart Estimate
          </Button>
          {aiError && <p className="text-xs text-red-600 self-center">{aiError}</p>}
        </div>

        {/* Totals */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center gap-4 justify-end">
            <Label className="text-sm">Tax Rate (%)</Label>
            <Input
              type="number"
              min="0"
              max="30"
              step="0.1"
              className="w-24 h-8 text-sm"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="text-sm space-y-1 text-right">
            <div className="flex justify-end gap-8"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {taxAmount > 0 && <div className="flex justify-end gap-8"><span className="text-gray-500">Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
            <div className="flex justify-end gap-8 font-bold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes (visible to customer)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes for customer..." />
        </div>

        {saveMutation.isError && (
          <p className="text-sm text-red-600">Failed to save quote. Please check all fields.</p>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={items.every(i => !i.description) || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : quote ? "Update Quote" : "Save Quote"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
