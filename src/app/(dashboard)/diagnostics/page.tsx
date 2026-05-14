"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Search, AlertTriangle, CheckCircle, Clock, Wrench, DollarSign,
  Plus, X, FileText, Shield, Star, BookOpen, Calendar, ChevronDown, ChevronUp,
  Loader2, AlertOctagon, Activity,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface DiagnosisResult {
  summary: string;
  confidence?: number;
  diagnoses: {
    rank: number; cause: string; probability: string; confidence?: number; explanation: string;
    repairNeeded: string; estimatedLaborHours: number;
    estimatedPartsCost: string; estimatedLaborCost: string; urgency: string;
  }[];
  recommendedServices: { service: string; reason: string; priority: string }[];
  safetyNotes: string;
  diagnosticSteps: string[];
}

interface DtcResult {
  code: string; description: string; system: string; severity: string;
  source?: string; causes?: string[]; estimatedCost?: string;
  ai?: { causes: string[]; diagnosticSteps: string[]; estimatedCost: string };
}

interface RepairGuide {
  title: string; overview: string; difficulty: string; estimatedTime: string; laborRate: string;
  safetyWarnings: string[];
  toolsRequired: { tool: string; notes?: string }[];
  partsRequired: { part: string; partNumber?: string; qty: number; estimatedCost?: string }[];
  fluidSpecs: { fluid: string; spec: string; capacity?: string }[];
  steps: { step: number; title: string; description: string; tip?: string; torqueSpec?: string }[];
  torqueSpecs: { component: string; spec: string }[];
  commonMistakes: string[];
  proTips: string[];
  postRepairChecks: string[];
  relatedServices: string[];
  knownIssues: string;
}

interface MaintenanceService {
  service: string; intervalMiles: number; intervalMonths: number;
  nextDue: string; status: string; priority: string;
  estimatedCost: string; notes: string; category: string;
}

interface Tsb {
  id?: string; number?: string; date?: string; title?: string;
  summary?: string; affectedSystems?: string; manufacturer?: string;
}

// ── Color helpers ──────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  Immediate: "bg-red-100 text-red-700 border-red-200",
  Soon: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Monitor: "bg-green-100 text-green-700 border-green-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-50 border-red-300",
  high: "bg-orange-50 border-orange-200",
  medium: "bg-yellow-50 border-yellow-200",
  low: "bg-gray-50 border-gray-200",
  High: "bg-red-50 border-red-200",
  Medium: "bg-yellow-50 border-yellow-200",
  Low: "bg-gray-50 border-gray-200",
};

const STATUS_COLORS: Record<string, string> = {
  overdue: "text-red-600 bg-red-50",
  due_soon: "text-yellow-600 bg-yellow-50",
  ok: "text-green-600 bg-green-50",
};

const DIFF_COLORS: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-yellow-100 text-yellow-700",
  Advanced: "bg-orange-100 text-orange-700",
  Professional: "bg-red-100 text-red-700",
};

function StarRating({ value }: { value?: string | number }) {
  const n = Number(value) || 0;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
      {n > 0 && <span className="text-xs ml-1 text-gray-600">{n}/5</span>}
    </span>
  );
}

// ── Tab types ──────────────────────────────────────────────────────────────

type Tab = "ai" | "dtc" | "tsb" | "guide" | "maintenance" | "safety";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "ai", label: "AI Diagnosis", icon: <Brain className="h-4 w-4" /> },
  { id: "dtc", label: "DTC Lookup", icon: <Search className="h-4 w-4" /> },
  { id: "tsb", label: "TSB Database", icon: <FileText className="h-4 w-4" /> },
  { id: "guide", label: "Repair Guide", icon: <BookOpen className="h-4 w-4" /> },
  { id: "maintenance", label: "Maint. Schedule", icon: <Calendar className="h-4 w-4" /> },
  { id: "safety", label: "Safety & Complaints", icon: <Shield className="h-4 w-4" /> },
];

// ── VehicleInputs (must be outside DiagnosticsPage to prevent remount on every keystroke) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VehicleInputs({ val, set, includeMileage = false }: { val: Record<string, string>; set: (v: any) => void; includeMileage?: boolean }) {
  return (
    <div className={`grid gap-2 ${includeMileage ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
      <div className="space-y-1">
        <Label className="text-xs">Year</Label>
        <Input placeholder="2020" value={val.year} onChange={e => set({ ...val, year: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Make *</Label>
        <Input placeholder="Toyota" value={val.make} onChange={e => set({ ...val, make: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Input placeholder="Camry" value={val.model} onChange={e => set({ ...val, model: e.target.value })} />
      </div>
      {includeMileage && (
        <div className="space-y-1">
          <Label className="text-xs">Mileage</Label>
          <Input placeholder="85000" value={val.mileage} onChange={e => set({ ...val, mileage: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function addDtcCode(list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) {
  const c = input.trim().toUpperCase();
  if (c && !list.includes(c)) setList([...list, c]);
  setInput("");
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function DiagnosticsPage() {
  const [tab, setTab] = useState<Tab>("ai");

  // Shared vehicle state
  const [vehicle, setVehicle] = useState({ year: "", make: "", model: "", mileage: "" });

  // AI Diagnosis state
  const [symptoms, setSymptoms] = useState("");
  const [dtcList, setDtcList] = useState<string[]>([]);
  const [dtcInput, setDtcInput] = useState("");
  const [priorRepairs, setPriorRepairs] = useState("");
  const [aiResult, setAiResult] = useState<DiagnosisResult | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [diagJobId, setDiagJobId] = useState<string>("");

  const { data: openJobsData } = useQuery({
    queryKey: ["diag-open-jobs"],
    queryFn: () => axios.get("/api/jobs?status=SCHEDULED,IN_PROGRESS,PARTS_WAITING&limit=50").then(r => r.data),
  });
  const openJobs: { id: string; jobNumber: string; title: string; customer: { firstName: string; lastName: string } }[] =
    openJobsData?.jobs || [];

  // DTC state
  const [dtcCode, setDtcCode] = useState("");
  const [dtcResult, setDtcResult] = useState<DtcResult | null>(null);
  const [dtcError, setDtcError] = useState("");

  // TSB state
  const [tsbSearch, setTsbSearch] = useState({ year: "", make: "", model: "" });
  const [tsbTrigger, setTsbTrigger] = useState(false);
  const [expandedTsb, setExpandedTsb] = useState<string | null>(null);

  // Repair guide state
  const [guideForm, setGuideForm] = useState({ year: "", make: "", model: "", mileage: "", repair: "", symptoms: "" });
  const [guideDtcs, setGuideDtcs] = useState<string[]>([]);
  const [guideDtcInput, setGuideDtcInput] = useState("");
  const [guideResult, setGuideResult] = useState<RepairGuide | null>(null);

  // Maintenance state
  const [maintForm, setMaintForm] = useState({ year: "", make: "", model: "", mileage: "" });
  const [maintTrigger, setMaintTrigger] = useState(false);

  // Safety state
  const [safetyForm, setSafetyForm] = useState({ year: "", make: "", model: "" });
  const [safetyTab, setSafetyTab] = useState<"safety" | "complaints">("safety");
  const [safetyTrigger, setSafetyTrigger] = useState<"safety" | "complaints" | null>(null);

  // ── Mutations / Queries ──────────────────────────────────────────────────

  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      setStreamingText("");
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vehicle, symptoms, dtcCodes: dtcList, priorRepairs, stream: true, jobId: diagJobId || undefined }),
      });
      if (!res.ok) throw new Error("Diagnosis failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) setStreamingText(prev => prev + parsed.text);
            if (parsed.done && parsed.result) return parsed.result as DiagnosisResult;
            if (parsed.done && parsed.error) throw new Error(parsed.error);
          } catch { /* ignore parse errors on partial chunks */ }
        }
      }
      throw new Error("Stream ended without result");
    },
    onSuccess: (result) => { setAiResult(result); setStreamingText(""); },
    onError: () => setStreamingText(""),
  });

  const dtcMutation = useMutation({
    mutationFn: () => {
      const p = new URLSearchParams({ code: dtcCode.toUpperCase() });
      if (vehicle.make) p.set("make", vehicle.make);
      if (vehicle.model) p.set("model", vehicle.model);
      if (vehicle.year) p.set("year", vehicle.year);
      return axios.get(`/api/dtc?${p}`).then(r => r.data);
    },
    onSuccess: (d) => { setDtcResult(d); setDtcError(""); },
    onError: (e: unknown) => {
      setDtcError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Code not found");
      setDtcResult(null);
    },
  });

  const tsbQuery = useQuery({
    queryKey: ["tsbs", tsbSearch.make, tsbSearch.model, tsbSearch.year],
    queryFn: () => {
      const p = new URLSearchParams({ make: tsbSearch.make });
      if (tsbSearch.model) p.set("model", tsbSearch.model);
      if (tsbSearch.year) p.set("year", tsbSearch.year);
      return axios.get(`/api/tsb-search?${p}`).then(r => r.data);
    },
    enabled: tsbTrigger && !!tsbSearch.make,
  });

  const guideMutation = useMutation({
    mutationFn: () => axios.post("/api/repair-guide", {
      ...guideForm,
      dtcCodes: guideDtcs,
    }).then(r => r.data.guide),
    onSuccess: setGuideResult,
  });

  const maintQuery = useQuery({
    queryKey: ["maintenance-schedule", maintForm.year, maintForm.make, maintForm.model, maintForm.mileage],
    queryFn: () => {
      const p = new URLSearchParams({ make: maintForm.make, model: maintForm.model });
      if (maintForm.year) p.set("year", maintForm.year);
      if (maintForm.mileage) p.set("mileage", maintForm.mileage);
      return axios.get(`/api/maintenance-schedule?${p}`).then(r => r.data);
    },
    enabled: maintTrigger && !!maintForm.make && !!maintForm.model,
  });

  const safetyQuery = useQuery({
    queryKey: ["vehicle-safety", safetyForm.year, safetyForm.make, safetyForm.model],
    queryFn: () => axios.get(`/api/nhtsa-safety?make=${encodeURIComponent(safetyForm.make)}&model=${encodeURIComponent(safetyForm.model)}&year=${safetyForm.year}`).then(r => r.data),
    enabled: safetyTrigger === "safety" && !!safetyForm.make,
  });

  const complaintsQuery = useQuery({
    queryKey: ["vehicle-complaints", safetyForm.year, safetyForm.make, safetyForm.model],
    queryFn: () => {
      const p = new URLSearchParams({ make: safetyForm.make });
      if (safetyForm.model) p.set("model", safetyForm.model);
      if (safetyForm.year) p.set("year", safetyForm.year);
      return axios.get(`/api/nhtsa-complaints?${p}`).then(r => r.data);
    },
    enabled: safetyTrigger === "complaints" && !!safetyForm.make,
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-blue-600" /> Diagnostic & Repair Center
        </h1>
        <p className="text-sm text-gray-500">
          AI diagnosis + NHTSA TSBs, safety ratings, complaints + step-by-step repair guides — all in one place
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── AI Diagnosis ── */}
      {tab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Vehicle Information</CardTitle></CardHeader>
              <CardContent>
                <VehicleInputs val={vehicle} set={setVehicle} includeMileage />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Symptoms & Fault Codes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Customer Symptoms *</Label>
                  <Textarea rows={4} placeholder="Describe what the customer experiences: noises, warning lights, driveability issues, when it happens..." value={symptoms} onChange={e => setSymptoms(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">DTC Codes (from scanner)</Label>
                  <div className="flex gap-2">
                    <Input placeholder="P0300" value={dtcInput} onChange={e => setDtcInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addDtcCode(dtcList, setDtcList, dtcInput, setDtcInput)} className="font-mono" />
                    <Button size="sm" variant="outline" onClick={() => addDtcCode(dtcList, setDtcList, dtcInput, setDtcInput)}><Plus className="h-4 w-4" /></Button>
                  </div>
                  {dtcList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {dtcList.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                          {c} <button onClick={() => setDtcList(dtcList.filter(x => x !== c))}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prior Repairs (optional)</Label>
                  <Input placeholder="e.g. New battery installed last month" value={priorRepairs} onChange={e => setPriorRepairs(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Save to Job (optional)</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                    value={diagJobId}
                    onChange={e => setDiagJobId(e.target.value)}
                  >
                    <option value="">— Don&apos;t save to job —</option>
                    {openJobs.map(j => (
                      <option key={j.id} value={j.id}>
                        #{j.jobNumber} — {j.title} ({j.customer.firstName} {j.customer.lastName})
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full" onClick={() => diagnoseMutation.mutate()} disabled={(!symptoms && dtcList.length === 0) || diagnoseMutation.isPending}>
              {diagnoseMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing with AI...</> : <><Brain className="h-4 w-4 mr-2" /> Run AI Diagnosis</>}
            </Button>
            {diagnoseMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                {(diagnoseMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Diagnosis failed. Make sure ANTHROPIC_API_KEY is configured."}
              </p>
            )}
          </div>
          <div className="space-y-4">
            {!aiResult && !diagnoseMutation.isPending && (
              <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">AI Diagnosis Results</p>
                <p className="text-sm mt-1">Enter vehicle info and symptoms, then click Analyze</p>
              </div>
            )}
            {diagnoseMutation.isPending && (
              <div className="p-6 border-2 border-blue-200 rounded-lg bg-blue-50 space-y-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <Brain className="h-5 w-5 animate-pulse" />
                  <span className="font-medium text-sm">AI is analyzing the vehicle...</span>
                </div>
                {streamingText ? (
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-40 overflow-auto bg-white/70 rounded p-3 border">
                    {streamingText}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500">Cross-referencing vehicle data and known issues...</p>
                )}
              </div>
            )}
            {aiResult && (
              <>
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-blue-900">{aiResult.summary}</p>
                      {aiResult.confidence != null && (
                        <Badge variant="outline" className="text-xs font-mono flex-shrink-0 border-blue-300 text-blue-700">
                          {aiResult.confidence}% confident
                        </Badge>
                      )}
                    </div>
                    {aiResult.safetyNotes && (
                      <div className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded p-2 border border-red-200">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {aiResult.safetyNotes}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Probable Causes</h3>
                  {aiResult.diagnoses.map(d => (
                    <Card key={d.rank} className={`border ${URGENCY_COLORS[d.urgency] || "border-gray-200"}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-gray-200 text-gray-700 w-5 h-5 rounded-full flex items-center justify-center">{d.rank}</span>
                            <p className="text-sm font-semibold">{d.cause}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                            <Badge variant="outline" className="text-xs">{d.probability}</Badge>
                            {d.confidence != null && (
                              <Badge variant="outline" className="text-xs font-mono">{d.confidence}%</Badge>
                            )}
                            <Badge className={`text-xs ${URGENCY_COLORS[d.urgency]}`}>{d.urgency}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{d.explanation}</p>
                        <div className="bg-white/70 rounded p-2 space-y-1">
                          <p className="text-xs font-medium"><Wrench className="h-3 w-3 inline mr-1" />{d.repairNeeded}</p>
                          <p className="text-xs text-gray-500"><Clock className="h-3 w-3 inline mr-1" />{d.estimatedLaborHours}h · Parts: {d.estimatedPartsCost} · Labor: {d.estimatedLaborCost}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {aiResult.recommendedServices?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700">Also Recommended</h3>
                    {aiResult.recommendedServices.map((s, i) => (
                      <div key={i} className={`p-2 rounded border text-sm ${PRIORITY_COLORS[s.priority] || "bg-gray-50 border-gray-200"}`}>
                        <p className="font-medium">{s.service}</p>
                        <p className="text-xs text-gray-500">{s.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
                {aiResult.diagnosticSteps?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700">Diagnostic Steps</h3>
                    <ol className="space-y-1">
                      {aiResult.diagnosticSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-xs font-bold bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── DTC Lookup ── */}
      {tab === "dtc" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">OBD-II / DTC Code Lookup</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fault Code *</Label>
                  <Input className="font-mono text-lg uppercase" placeholder="P0300" value={dtcCode} onChange={e => setDtcCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && dtcCode && dtcMutation.mutate()} maxLength={6} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Add vehicle context for AI-enhanced analysis:</p>
                  <VehicleInputs val={vehicle} set={setVehicle} />
                </div>
                <Button className="w-full" onClick={() => dtcMutation.mutate()} disabled={!dtcCode || dtcMutation.isPending}>
                  <Search className="h-4 w-4 mr-2" />{dtcMutation.isPending ? "Looking up..." : "Look Up Code"}
                </Button>
                {dtcError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{dtcError}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-xs text-gray-500">Code Prefix Guide</CardTitle></CardHeader>
              <CardContent className="text-xs text-gray-600 space-y-1">
                <p><span className="font-mono font-bold text-blue-600">P0xxx</span> — Generic Powertrain (all makes)</p>
                <p><span className="font-mono font-bold text-blue-600">P1xxx</span> — Manufacturer-specific Powertrain</p>
                <p><span className="font-mono font-bold text-purple-600">B0xxx</span> — Generic Body</p>
                <p><span className="font-mono font-bold text-orange-600">C0xxx</span> — Generic Chassis (ABS/Stability)</p>
                <p><span className="font-mono font-bold text-green-600">U0xxx</span> — Generic Network/Communication</p>
                <p className="mt-2 text-gray-400">2,000+ codes in database · AI fallback for any unlisted code</p>
              </CardContent>
            </Card>
          </div>
          <div>
            {!dtcResult && !dtcMutation.isPending && (
              <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Enter a fault code to look it up</p>
                <p className="text-sm mt-1">P, B, C, and U codes supported</p>
              </div>
            )}
            {dtcMutation.isPending && (
              <div className="p-12 text-center border-2 border-blue-200 rounded-lg bg-blue-50 text-blue-600">
                <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin" />
                <p className="font-medium">Looking up code...</p>
              </div>
            )}
            {dtcResult && (
              <div className="space-y-3">
                <Card className={`border-2 ${dtcResult.severity === "high" ? "border-red-300 bg-red-50" : dtcResult.severity === "medium" ? "border-yellow-300 bg-yellow-50" : "border-green-300 bg-green-50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-2xl font-mono font-bold">{dtcResult.code}</p>
                        <p className="text-sm font-semibold mt-1">{dtcResult.description}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge className={dtcResult.severity === "high" ? "bg-red-100 text-red-700" : dtcResult.severity === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}>
                          {dtcResult.severity?.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{dtcResult.system}</Badge>
                        {dtcResult.source === "ai" && <Badge className="bg-blue-100 text-blue-700">AI Analysis</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {(dtcResult.ai?.causes || dtcResult.causes) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Likely Causes</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {(dtcResult.ai?.causes || dtcResult.causes || []).map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-xs font-bold bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          {c}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {dtcResult.ai?.diagnosticSteps && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Diagnostic Steps</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {dtcResult.ai.diagnosticSteps.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> {s}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {(dtcResult.ai?.estimatedCost || dtcResult.estimatedCost) && (
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-xs text-gray-500">Estimated Repair Cost</p>
                        <p className="font-semibold">{dtcResult.ai?.estimatedCost || dtcResult.estimatedCost}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TSB Database ── */}
      {tab === "tsb" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" /> Technical Service Bulletins (NHTSA Database)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">TSBs are manufacturer-issued repair instructions for known issues. Data sourced directly from NHTSA.</p>
              <VehicleInputs val={tsbSearch} set={setTsbSearch} />
              <Button onClick={() => { setTsbTrigger(false); setTimeout(() => setTsbTrigger(true), 0); }} disabled={!tsbSearch.make || tsbQuery.isFetching}>
                <Search className="h-4 w-4 mr-2" />{tsbQuery.isFetching ? "Searching NHTSA..." : "Search TSBs"}
              </Button>
            </CardContent>
          </Card>

          {tsbQuery.isFetching && (
            <div className="p-8 text-center text-blue-600"><Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" /><p>Querying NHTSA TSB database...</p></div>
          )}

          {tsbQuery.data && !tsbQuery.isFetching && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">
                  {tsbQuery.data.count} TSBs found for {tsbSearch.year} {tsbSearch.make} {tsbSearch.model}
                </h3>
                {tsbQuery.data.count === 0 && <p className="text-sm text-gray-500">No TSBs on record for this vehicle.</p>}
              </div>
              <div className="space-y-2">
                {(tsbQuery.data.tsbs || []).map((tsb: Tsb, i: number) => (
                  <Card key={tsb.id || i} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {tsb.number && <span className="font-mono text-sm font-bold text-orange-600">{tsb.number}</span>}
                            {tsb.date && <span className="text-xs text-gray-400">{new Date(tsb.date).toLocaleDateString()}</span>}
                            {tsb.affectedSystems && <Badge variant="outline" className="text-xs">{tsb.affectedSystems}</Badge>}
                          </div>
                          <p className="font-medium text-sm mt-1">{tsb.title || "Technical Service Bulletin"}</p>
                          {tsb.manufacturer && <p className="text-xs text-gray-400">Issued by: {tsb.manufacturer}</p>}
                        </div>
                        <button onClick={() => setExpandedTsb(expandedTsb === (tsb.id || String(i)) ? null : (tsb.id || String(i)))}>
                          {expandedTsb === (tsb.id || String(i)) ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </button>
                      </div>
                      {expandedTsb === (tsb.id || String(i)) && tsb.summary && (
                        <div className="mt-3 pt-3 border-t text-sm text-gray-700 bg-gray-50 rounded p-3">
                          {tsb.summary}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Repair Guide ── */}
      {tab === "guide" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-green-600" /> AI Repair Guide Generator</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-500">Generate professional step-by-step repair procedures with torque specs, tools, and parts lists.</p>
                  <VehicleInputs val={guideForm} set={setGuideForm} includeMileage />
                  <div className="space-y-1">
                    <Label className="text-xs">Repair / Service Needed *</Label>
                    <Input placeholder="e.g. Replace front brake pads and rotors" value={guideForm.repair} onChange={e => setGuideForm({ ...guideForm, repair: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Symptoms (optional)</Label>
                    <Input placeholder="e.g. Grinding noise when braking" value={guideForm.symptoms} onChange={e => setGuideForm({ ...guideForm, symptoms: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">DTC Codes (optional)</Label>
                    <div className="flex gap-2">
                      <Input className="font-mono" placeholder="P0420" value={guideDtcInput} onChange={e => setGuideDtcInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addDtcCode(guideDtcs, setGuideDtcs, guideDtcInput, setGuideDtcInput)} />
                      <Button size="sm" variant="outline" onClick={() => addDtcCode(guideDtcs, setGuideDtcs, guideDtcInput, setGuideDtcInput)}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {guideDtcs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {guideDtcs.map(c => (
                          <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                            {c} <button onClick={() => setGuideDtcs(guideDtcs.filter(x => x !== c))}><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => guideMutation.mutate()} disabled={!guideForm.repair || guideMutation.isPending}>
                    {guideMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating guide...</> : <><BookOpen className="h-4 w-4 mr-2" /> Generate Repair Guide</>}
                  </Button>
                  {guideMutation.isError && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {(guideMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to generate guide."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {!guideResult && !guideMutation.isPending && (
                <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Repair guide will appear here</p>
                  <p className="text-sm mt-1">Includes torque specs, tools, parts, step-by-step instructions</p>
                </div>
              )}
              {guideMutation.isPending && (
                <div className="p-12 text-center text-green-600 border-2 border-green-200 rounded-lg bg-green-50">
                  <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin" />
                  <p className="font-medium">Generating repair guide...</p>
                  <p className="text-sm text-gray-500 mt-1">AI is writing vehicle-specific procedures</p>
                </div>
              )}
              {guideResult && (
                <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <h2 className="font-bold text-gray-900 text-base">{guideResult.title}</h2>
                      <p className="text-sm text-gray-700 mt-1">{guideResult.overview}</p>
                      <div className="flex gap-2 flex-wrap mt-3">
                        <Badge className={DIFF_COLORS[guideResult.difficulty] || "bg-gray-100 text-gray-700"}>{guideResult.difficulty}</Badge>
                        <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{guideResult.estimatedTime}</Badge>
                        <Badge variant="outline"><DollarSign className="h-3 w-3 mr-1" />{guideResult.laborRate}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {guideResult.safetyWarnings?.length > 0 && (
                    <Card className="border-red-200 bg-red-50">
                      <CardHeader><CardTitle className="text-sm text-red-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Safety Warnings</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        {guideResult.safetyWarnings.map((w, i) => <p key={i} className="text-sm text-red-700">⚠ {w}</p>)}
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.toolsRequired?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Tools Required</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {guideResult.toolsRequired.map((t, i) => (
                            <div key={i} className="px-2 py-1 bg-gray-100 rounded text-sm">
                              <span className="font-medium">{t.tool}</span>
                              {t.notes && <span className="text-gray-500 text-xs ml-1">({t.notes})</span>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.partsRequired?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Parts Required</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {guideResult.partsRequired.map((p, i) => (
                            <div key={i} className="flex justify-between text-sm border-b last:border-0 pb-1">
                              <div>
                                <span className="font-medium">{p.part}</span>
                                {p.partNumber && <span className="text-xs text-gray-400 ml-2 font-mono">#{p.partNumber}</span>}
                                <span className="text-xs text-gray-500 ml-2">×{p.qty}</span>
                              </div>
                              {p.estimatedCost && <span className="text-green-700 font-medium">{p.estimatedCost}</span>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.fluidSpecs?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Fluid Specifications</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        {guideResult.fluidSpecs.map((f, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600">{f.fluid}</span>
                            <div className="text-right">
                              <span className="font-medium">{f.spec}</span>
                              {f.capacity && <span className="text-gray-400 text-xs ml-2">{f.capacity}</span>}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.steps?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Step-by-Step Procedure</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        {guideResult.steps.map(s => (
                          <div key={s.step} className="flex gap-3">
                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">{s.step}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{s.title}</p>
                              <p className="text-sm text-gray-600 mt-0.5">{s.description}</p>
                              {s.torqueSpec && (
                                <p className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-2 py-0.5 mt-1 inline-block">
                                  🔧 Torque: {s.torqueSpec}
                                </p>
                              )}
                              {s.tip && (
                                <p className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 mt-1">
                                  💡 {s.tip}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.torqueSpecs?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Torque Specifications</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {guideResult.torqueSpecs.map((t, i) => (
                            <div key={i} className="flex justify-between text-sm border-b last:border-0 pb-1">
                              <span className="text-gray-700">{t.component}</span>
                              <span className="font-mono font-medium text-orange-700">{t.spec}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.commonMistakes?.length > 0 && (
                    <Card className="border-orange-200">
                      <CardHeader><CardTitle className="text-sm text-orange-700">Common Mistakes to Avoid</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        {guideResult.commonMistakes.map((m, i) => <p key={i} className="text-sm text-gray-700">✗ {m}</p>)}
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.proTips?.length > 0 && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader><CardTitle className="text-sm text-blue-700">Pro Tips</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        {guideResult.proTips.map((t, i) => <p key={i} className="text-sm text-blue-800">✓ {t}</p>)}
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.postRepairChecks?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Post-Repair Verification</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        {guideResult.postRepairChecks.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> {c}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {guideResult.knownIssues && (
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardHeader><CardTitle className="text-sm text-yellow-800 flex items-center gap-1"><AlertOctagon className="h-4 w-4" /> Known Issues / TSBs</CardTitle></CardHeader>
                      <CardContent><p className="text-sm text-yellow-900">{guideResult.knownIssues}</p></CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Maintenance Schedule ── */}
      {tab === "maintenance" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-600" /> AI Maintenance Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Get a complete, vehicle-specific maintenance schedule with manufacturer-recommended intervals, fluid specs, and current status.</p>
              <VehicleInputs val={maintForm} set={setMaintForm} includeMileage />
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => { setMaintTrigger(false); setTimeout(() => setMaintTrigger(true), 0); }} disabled={!maintForm.make || !maintForm.model || maintQuery.isFetching}>
                {maintQuery.isFetching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Calendar className="h-4 w-4 mr-2" /> Generate Schedule</>}
              </Button>
            </CardContent>
          </Card>

          {maintQuery.isFetching && (
            <div className="p-8 text-center text-purple-600"><Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" /><p>Building maintenance schedule...</p></div>
          )}

          {maintQuery.data && !maintQuery.isFetching && (() => {
            const sched = maintQuery.data.schedule;
            return (
              <div className="space-y-4">
                {sched.criticalNotes && (
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-3 flex items-start gap-2">
                      <AlertOctagon className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-900">{sched.criticalNotes}</p>
                    </CardContent>
                  </Card>
                )}

                {sched.fluidSpecs && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Fluid Specifications for {maintForm.year} {maintForm.make} {maintForm.model}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(sched.fluidSpecs).map(([key, val]) => (
                          <div key={key} className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="text-sm font-medium">{String(val)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {sched.timingBelt?.applicable && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-800">Timing Belt Required — {sched.timingBelt.interval}</p>
                        <p className="text-xs text-red-700 mt-0.5">{sched.timingBelt.notes}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-800">Service Schedule</h3>
                  {["overdue", "due_soon", "ok"].map(status => {
                    const items = (sched.services || []).filter((s: MaintenanceService) => s.status === status);
                    if (items.length === 0) return null;
                    return (
                      <div key={status}>
                        <p className={`text-xs font-bold uppercase mb-2 px-2 py-1 rounded inline-block ${STATUS_COLORS[status]}`}>
                          {status === "overdue" ? "⚠ Overdue" : status === "due_soon" ? "⏰ Due Soon" : "✓ Up to Date"}
                        </p>
                        <div className="space-y-2">
                          {items.map((s: MaintenanceService, i: number) => (
                            <Card key={i} className={`border ${PRIORITY_COLORS[s.priority] || "border-gray-200"}`}>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-sm">{s.service}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{s.notes}</p>
                                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                      {s.intervalMiles && <span>Every {s.intervalMiles.toLocaleString()} mi</span>}
                                      {s.intervalMonths && <span>/ {s.intervalMonths} months</span>}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-medium text-green-700">{s.estimatedCost}</p>
                                    <p className="text-xs text-gray-400 mt-1">Next: {s.nextDue}</p>
                                    <Badge variant="outline" className="text-xs mt-1">{s.category}</Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Safety & Complaints ── */}
      {tab === "safety" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-blue-600" /> NHTSA Safety Data</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Official safety ratings and owner complaints from the NHTSA database.</p>
              <VehicleInputs val={safetyForm} set={setSafetyForm} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSafetyTrigger("safety")} disabled={!safetyForm.make || safetyQuery.isFetching}>
                  <Star className="h-4 w-4 mr-2" />{safetyQuery.isFetching ? "Loading..." : "Safety Ratings"}
                </Button>
                <Button variant="outline" onClick={() => setSafetyTrigger("complaints")} disabled={!safetyForm.make || complaintsQuery.isFetching}>
                  <Activity className="h-4 w-4 mr-2" />{complaintsQuery.isFetching ? "Loading..." : "Owner Complaints"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Safety Ratings */}
          {safetyQuery.data?.ratings && (
            <Card>
              <CardHeader><CardTitle className="text-sm">NHTSA Safety Ratings — {safetyForm.year} {safetyForm.make} {safetyForm.model}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: "Overall Safety", value: safetyQuery.data.ratings.overall },
                    { label: "Overall Frontal Crash", value: safetyQuery.data.ratings.overallFrontCrash },
                    { label: "Overall Side Crash", value: safetyQuery.data.ratings.overallSideCrash },
                    { label: "Rollover", value: safetyQuery.data.ratings.rollover },
                    { label: "Driver Front", value: safetyQuery.data.ratings.driverFront },
                    { label: "Passenger Front", value: safetyQuery.data.ratings.passengerFront },
                    { label: "Driver Side", value: safetyQuery.data.ratings.driverSide },
                    { label: "Driver Pole", value: safetyQuery.data.ratings.driverPole },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} className="bg-gray-50 rounded p-3">
                      <p className="text-xs text-gray-500 mb-1">{r.label}</p>
                      <StarRating value={r.value} />
                    </div>
                  ))}
                </div>
                {safetyQuery.data.ratings.rolloverPossibility && (
                  <p className="text-xs text-gray-500 mt-3">Rollover Possibility: {safetyQuery.data.ratings.rolloverPossibility}</p>
                )}
              </CardContent>
            </Card>
          )}
          {safetyQuery.data && !safetyQuery.data.ratings && safetyTrigger === "safety" && !safetyQuery.isFetching && (
            <Card><CardContent className="p-4 text-sm text-gray-500">No NHTSA safety rating data found for this vehicle.</CardContent></Card>
          )}

          {/* Owner Complaints */}
          {complaintsQuery.data && !complaintsQuery.isFetching && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {complaintsQuery.data.count} Owner Complaints — {safetyForm.year} {safetyForm.make} {safetyForm.model}
                </h3>
              </div>

              {complaintsQuery.data.componentStats?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Most Reported Components</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {complaintsQuery.data.componentStats.map((c: { component: string; count: number }, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700 truncate">{c.component}</span>
                            <span className="font-medium ml-2">{c.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-2 bg-red-400 rounded-full" style={{ width: `${(c.count / complaintsQuery.data.componentStats[0].count) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                {complaintsQuery.data.complaints?.slice(0, 20).map((c: {
                  id?: string; component?: string; dateFiled?: string;
                  summary?: string; crash?: boolean; injury?: boolean;
                }, i: number) => (
                  <Card key={c.id || i} className={c.crash || c.injury ? "border-red-200" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{c.component || "General"}</Badge>
                            {c.crash && <Badge className="bg-red-100 text-red-700 text-xs">Crash</Badge>}
                            {c.injury && <Badge className="bg-orange-100 text-orange-700 text-xs">Injury</Badge>}
                            {c.dateFiled && <span className="text-xs text-gray-400">{new Date(c.dateFiled).toLocaleDateString()}</span>}
                          </div>
                          <p className="text-sm text-gray-700 mt-1 leading-relaxed">{c.summary}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
