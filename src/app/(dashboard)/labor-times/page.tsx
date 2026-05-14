"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Timer, Search, Loader2, Clock, Wrench, AlertCircle, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface LaborResult {
  laborHours: number;
  skillLevel: string;
  notes: string;
  repair: string;
  year: string;
  make: string;
  model: string;
  cached: boolean;
}

const COMMON_REPAIRS = [
  "Oil change", "Brake pad replacement", "Tire rotation", "Alternator replacement",
  "Starter replacement", "Spark plugs", "Transmission fluid service", "Coolant flush",
  "Power steering flush", "AC recharge", "Battery replacement", "Water pump replacement",
  "Timing belt replacement", "Head gasket repair", "Strut replacement", "CV axle replacement",
  "Fuel pump replacement", "Oxygen sensor replacement", "Catalytic converter replacement",
  "Radiator replacement", "Thermostat replacement", "Serpentine belt replacement",
];

const LABOR_RATES = [85, 95, 105, 115, 125, 135, 150];

export default function LaborTimesPage() {
  const [form, setForm] = useState({ year: "", make: "", model: "", repair: "" });
  const [laborRate, setLaborRate] = useState(105);
  const [result, setResult] = useState<LaborResult | null>(null);
  const [history, setHistory] = useState<LaborResult[]>([]);

  // Load shop's configured labor rate as default; also restore session history
  useEffect(() => {
    axios.get("/api/shops/settings").then(({ data }) => {
      if (data.laborRate) setLaborRate(data.laborRate);
    }).catch(() => {});
    try {
      const saved = localStorage.getItem("labor_times_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const lookupMutation = useMutation({
    mutationFn: () => {
      const p = new URLSearchParams({ year: form.year, make: form.make, model: form.model, repair: form.repair });
      return axios.get<LaborResult>(`/api/labor-times?${p}`).then(r => r.data);
    },
    onSuccess: (data) => {
      setResult(data);
      setHistory(prev => {
        const next = [data, ...prev.filter(h => !(h.repair === data.repair && h.make === data.make && h.model === data.model && h.year === data.year))].slice(0, 10);
        try { localStorage.setItem("labor_times_history", JSON.stringify(next)); } catch {}
        return next;
      });
    },
  });

  const laborCost = result ? result.laborHours * laborRate : 0;

  const skillColors: Record<string, string> = {
    "Beginner": "bg-green-100 text-green-700",
    "Intermediate": "bg-yellow-100 text-yellow-700",
    "Advanced": "bg-orange-100 text-orange-700",
    "Expert": "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Timer className="h-6 w-6 text-blue-600" /> Flat Rate Labor Guide</h1>
        <p className="text-sm text-gray-500">AI-powered labor time estimates for any repair — backed by real-world data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Form */}
        <div className="lg:col-span-2 space-y-4">
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
              <div className="space-y-1">
                <Label className="text-xs">Repair / Service *</Label>
                <Input
                  placeholder="e.g. front brake pad replacement, water pump, timing belt..."
                  value={form.repair}
                  onChange={e => setForm({ ...form, repair: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && form.repair && lookupMutation.mutate()}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {COMMON_REPAIRS.slice(0, 12).map(r => (
                  <button key={r} onClick={() => setForm({ ...form, repair: r })}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border transition-colors">
                    {r}
                  </button>
                ))}
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => lookupMutation.mutate()}
                disabled={!form.repair || lookupMutation.isPending}
              >
                {lookupMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Looking up...</> : <><Search className="h-4 w-4 mr-2" /> Get Labor Time</>}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-600" />
                  {result.repair}
                  {result.cached && <Badge variant="outline" className="text-xs ml-auto">Cached</Badge>}
                </CardTitle>
                {(result.year || result.make || result.model) && (
                  <p className="text-sm text-gray-500">{result.year} {result.make} {result.model}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-3 border text-center">
                    <p className="text-xs text-gray-500 mb-1">Labor Hours</p>
                    <p className="text-3xl font-bold text-blue-600">{result.laborHours}</p>
                    <p className="text-xs text-gray-400">hours</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border text-center">
                    <p className="text-xs text-gray-500 mb-1">Labor Cost</p>
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(laborCost)}</p>
                    <p className="text-xs text-gray-400">@ {formatCurrency(laborRate)}/hr</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border text-center">
                    <p className="text-xs text-gray-500 mb-1">Skill Level</p>
                    <Badge className={`${skillColors[result.skillLevel] || "bg-gray-100 text-gray-700"} mt-1`}>{result.skillLevel}</Badge>
                  </div>
                </div>

                {result.notes && (
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{result.notes}</p>
                    </div>
                  </div>
                )}

                {/* Rate adjuster */}
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Adjust Labor Rate</p>
                  <div className="flex gap-2 flex-wrap">
                    {LABOR_RATES.map(rate => (
                      <button key={rate} onClick={() => setLaborRate(rate)}
                        className={`px-3 py-1 text-sm rounded border transition-colors ${laborRate === rate ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"}`}>
                        {formatCurrency(rate)}/hr
                      </button>
                    ))}
                  </div>
                  <p className="text-lg font-bold text-green-600 mt-2">Total Labor: {formatCurrency(result.laborHours * laborRate)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: history + reference */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-1"><Clock className="h-4 w-4" /> Recent Lookups</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No recent lookups</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <button key={i} className="w-full text-left p-2 rounded-lg border hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      onClick={() => { setForm({ year: h.year, make: h.make, model: h.model, repair: h.repair }); setResult(h); }}>
                      <p className="text-sm font-medium truncate">{h.repair}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500">{h.year} {h.make} {h.model}</p>
                        <span className="text-xs font-bold text-blue-600">{h.laborHours}h</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-amber-900 text-sm mb-2">Labor Time Tips</h3>
              <ul className="text-xs text-amber-800 space-y-1.5">
                <li>• Times include R&R (remove & replace)</li>
                <li>• Add 15-30% for heavily corroded bolts</li>
                <li>• Times assume vehicle is on a lift</li>
                <li>• First-time techs may need 1.5–2× the flat rate</li>
                <li>• Always verify with Mitchell 1 or AllData for exact model variants</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
