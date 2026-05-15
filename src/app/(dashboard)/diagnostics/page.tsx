"use client";

import { useState, useEffect } from "react";
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
  Loader2, AlertOctagon, Activity, Database, Thermometer, Wind, Cpu,
  Copy, Check, MessageCircle, Briefcase, TrendingUp, Gauge, Navigation,
  Crosshair,
} from "lucide-react";

// ── Common makes datalist ────────────────────────────────────────────────────
const COMMON_MAKES = [
  "Acura","Alfa Romeo","Audi","BMW","Buick","Cadillac","Chevrolet","Chrysler",
  "Dodge","Ferrari","Fiat","Ford","Genesis","GMC","Honda","Hyundai","Infiniti",
  "Jaguar","Jeep","Kia","Land Rover","Lexus","Lincoln","Maserati","Mazda",
  "Mercedes-Benz","Mercury","MINI","Mitsubishi","Nissan","Oldsmobile","Pontiac",
  "Porsche","Ram","Rivian","Rolls-Royce","Saturn","Scion","Subaru","Tesla",
  "Toyota","Volkswagen","Volvo",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => String(CURRENT_YEAR - i));

// ── SmartVehicleInputs ───────────────────────────────────────────────────────
interface VehicleVal { year: string; make: string; model: string; mileage?: string }

function SmartVehicleInputs({
  val, set, includeMileage = false, compact = false,
}: {
  val: VehicleVal;
  set: (v: VehicleVal) => void;
  includeMileage?: boolean;
  compact?: boolean;
}) {
  const cols = includeMileage ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";
  return (
    <div className={`grid gap-2 ${compact ? "gap-1.5" : ""} ${cols}`}>
      <datalist id="makes-list">
        {COMMON_MAKES.map(m => <option key={m} value={m} />)}
      </datalist>

      <div className="space-y-1">
        <Label className="text-xs">Year</Label>
        <select
          className="w-full border rounded-md px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={val.year}
          onChange={e => set({ ...val, year: e.target.value })}
        >
          <option value="">Select year</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Make *</Label>
        <input
          list="makes-list"
          className="w-full border rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Toyota"
          value={val.make}
          onChange={e => set({ ...val, make: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Input
          placeholder="Camry"
          value={val.model}
          onChange={e => set({ ...val, model: e.target.value })}
        />
      </div>

      {includeMileage && (
        <div className="space-y-1">
          <Label className="text-xs">Mileage</Label>
          <Input
            type="number"
            placeholder="85000"
            value={val.mileage ?? ""}
            onChange={e => set({ ...val, mileage: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDtcCode(list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) {
  const c = input.trim().toUpperCase();
  if (c && !list.includes(c)) setList([...list, c]);
  setInput("");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm" variant="outline"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>}
    </Button>
  );
}

// ── Color helpers ────────────────────────────────────────────────────────────
const URGENCY_COLORS: Record<string, string> = {
  Immediate: "bg-red-100 text-red-700 border-red-200",
  Soon: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Monitor: "bg-green-100 text-green-700 border-green-200",
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-50 border-red-300", high: "bg-orange-50 border-orange-200",
  medium: "bg-yellow-50 border-yellow-200", low: "bg-gray-50 border-gray-200",
  High: "bg-red-50 border-red-200", Medium: "bg-yellow-50 border-yellow-200", Low: "bg-gray-50 border-gray-200",
};
const STATUS_COLORS: Record<string, string> = {
  overdue: "text-red-600 bg-red-50", due_soon: "text-yellow-600 bg-yellow-50", ok: "text-green-600 bg-green-50",
};
const DIFF_COLORS: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700", Intermediate: "bg-yellow-100 text-yellow-700",
  Advanced: "bg-orange-100 text-orange-700", Professional: "bg-red-100 text-red-700",
};

function StarRating({ value }: { value?: string | number }) {
  const n = Number(value) || 0;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
      {n > 0 && <span className="text-xs ml-1 text-gray-600">{n}/5</span>}
    </span>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
interface DiagnosisResult {
  summary: string; confidence?: number;
  diagnoses: { rank: number; cause: string; probability: string; confidence?: number; explanation: string; repairNeeded: string; estimatedLaborHours: number; estimatedPartsCost: string; estimatedLaborCost: string; urgency: string }[];
  recommendedServices: { service: string; reason: string; priority: string }[];
  safetyNotes: string; diagnosticSteps: string[];
}
interface DtcResult {
  code: string; description: string; system: string; severity: string; source?: string;
  causes?: string[]; estimatedCost?: string;
  ai?: { causes: string[]; diagnosticSteps: string[]; estimatedCost: string };
}
interface RepairGuide {
  title: string; overview: string; difficulty: string; estimatedTime: string; laborRate: string;
  safetyWarnings: string[]; toolsRequired: { tool: string; notes?: string }[];
  partsRequired: { part: string; partNumber?: string; qty: number; estimatedCost?: string }[];
  fluidSpecs: { fluid: string; spec: string; capacity?: string }[];
  steps: { step: number; title: string; description: string; tip?: string; torqueSpec?: string }[];
  torqueSpecs: { component: string; spec: string }[]; commonMistakes: string[];
  proTips: string[]; postRepairChecks: string[]; relatedServices: string[]; knownIssues: string;
}
interface MaintenanceService {
  service: string; intervalMiles: number; intervalMonths: number; nextDue: string;
  status: string; priority: string; estimatedCost: string; notes: string; category: string;
}
interface Tsb { id?: string; number?: string; date?: string; title?: string; summary?: string; affectedSystems?: string; manufacturer?: string }
interface FreezeFrameResult {
  summary: string; urgency: string; driveable: boolean;
  abnormalReadings: { pid: string; value: string; normal: string; significance: string }[];
  rootCauses: string[]; diagnosticSteps: string[];
}
interface PatternFailure {
  id: string; year: number; make: string; model: string; engine?: string;
  dtcCodes: string[]; symptoms: string[]; confirmedFix: string; partNumbers: string[];
  laborHours?: number; successCount: number; notes?: string; createdAt: string;
}
interface AdasResult {
  vehicle: string; systems: string[]; event: string;
  calibrations: { system: string; type: string; requirements: string[]; procedure: string; notes: string }[];
}
interface EmissionsResult {
  state: string; requiresObd: boolean; cutoffYear?: number; exemptMileage?: number;
  notes?: string; analysisRequired?: boolean;
  analysis?: { readinessStatus: string; incompleteMonitors: string[]; driveCycle: string[]; readyForTest: boolean; recommendation: string };
}

// ── Tab config ───────────────────────────────────────────────────────────────
type Tab = "ai" | "dtc" | "specs" | "freeze" | "patterns" | "tsb" | "guide" | "maintenance" | "adas" | "emissions" | "safety";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "ai",         label: "AI Diagnosis",    icon: <Brain className="h-4 w-4" /> },
  { id: "dtc",        label: "DTC Lookup",       icon: <Search className="h-4 w-4" /> },
  { id: "specs",      label: "Vehicle Specs",    icon: <Database className="h-4 w-4" /> },
  { id: "freeze",     label: "Freeze Frame",     icon: <Thermometer className="h-4 w-4" /> },
  { id: "patterns",   label: "Pattern Fixes",    icon: <TrendingUp className="h-4 w-4" /> },
  { id: "tsb",        label: "TSB Database",     icon: <FileText className="h-4 w-4" /> },
  { id: "guide",      label: "Repair Guide",     icon: <BookOpen className="h-4 w-4" /> },
  { id: "maintenance",label: "Maint. Schedule",  icon: <Calendar className="h-4 w-4" /> },
  { id: "adas",       label: "ADAS Calib.",      icon: <Crosshair className="h-4 w-4" /> },
  { id: "emissions",  label: "Emissions",        icon: <Wind className="h-4 w-4" /> },
  { id: "safety",     label: "Safety & Complaints", icon: <Shield className="h-4 w-4" /> },
];

const ADAS_EVENTS = [
  { value: "", label: "Select event..." },
  { value: "windshield_replacement", label: "Windshield Replacement" },
  { value: "alignment", label: "Wheel Alignment" },
  { value: "collision", label: "Collision Repair" },
  { value: "sensor_replacement", label: "Sensor Replacement" },
  { value: "suspension", label: "Suspension Work" },
  { value: "battery_disconnect", label: "Battery Disconnect" },
  { value: "oil_change", label: "Routine Service / Oil Change" },
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
];

// ── Main Page ────────────────────────────────────────────────────────────────
export default function DiagnosticsPage() {
  const [tab, setTab] = useState<Tab>("ai");

  // Shared vehicle state (synced across tabs)
  const [vehicle, setVehicle] = useState<VehicleVal>({ year: "", make: "", model: "", mileage: "" });

  // AI Diagnosis
  const [symptoms, setSymptoms] = useState("");
  const [dtcList, setDtcList] = useState<string[]>([]);
  const [dtcInput, setDtcInput] = useState("");
  const [priorRepairs, setPriorRepairs] = useState("");
  const [aiResult, setAiResult] = useState<DiagnosisResult | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [diagJobId, setDiagJobId] = useState("");
  const [showCustomerText, setShowCustomerText] = useState(false);
  const [createJobLoading, setCreateJobLoading] = useState(false);
  const [createJobSuccess, setCreateJobSuccess] = useState("");

  const { data: openJobsData } = useQuery({
    queryKey: ["diag-open-jobs"],
    queryFn: () => axios.get("/api/jobs?status=SCHEDULED,IN_PROGRESS,PARTS_WAITING&limit=50").then(r => r.data),
  });
  const openJobs: { id: string; jobNumber: string; title: string; customer: { firstName: string; lastName: string } }[] =
    openJobsData?.jobs || [];

  // DTC
  const [dtcCode, setDtcCode] = useState("");
  const [dtcResult, setDtcResult] = useState<DtcResult | null>(null);
  const [dtcError, setDtcError] = useState("");

  // Vehicle Specs
  const [specsVehicle, setSpecsVehicle] = useState<VehicleVal>({ year: "", make: "", model: "" });
  const [specsResult, setSpecsResult] = useState<Record<string, unknown> | null>(null);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [specsError, setSpecsError] = useState("");

  // Freeze Frame
  const [freezeData, setFreezeData] = useState("");
  const [freezeVehicle, setFreezeVehicle] = useState<VehicleVal>({ year: "", make: "", model: "" });
  const [freezeResult, setFreezeResult] = useState<FreezeFrameResult | null>(null);

  // Pattern Failures
  const [patternVehicle, setPatternVehicle] = useState<VehicleVal>({ year: "", make: "", model: "" });
  const [patternCode, setPatternCode] = useState("");
  const [patternResults, setPatternResults] = useState<PatternFailure[]>([]);
  const [patternTrigger, setPatternTrigger] = useState(false);
  const [showSubmitFix, setShowSubmitFix] = useState(false);
  const [submitFix, setSubmitFix] = useState({ confirmedFix: "", symptoms: "", dtcCodes: "", partNumbers: "", laborHours: "", notes: "" });
  const [submitFixLoading, setSubmitFixLoading] = useState(false);
  const [submitFixSuccess, setSubmitFixSuccess] = useState(false);

  // TSB
  const [tsbSearch, setTsbSearch] = useState<VehicleVal>({ year: "", make: "", model: "" });
  const [tsbTrigger, setTsbTrigger] = useState(false);
  const [expandedTsb, setExpandedTsb] = useState<string | null>(null);

  // Repair Guide
  const [guideForm, setGuideForm] = useState<VehicleVal & { repair: string; symptoms: string }>({ year: "", make: "", model: "", mileage: "", repair: "", symptoms: "" });
  const [guideDtcs, setGuideDtcs] = useState<string[]>([]);
  const [guideDtcInput, setGuideDtcInput] = useState("");
  const [guideResult, setGuideResult] = useState<RepairGuide | null>(null);

  // Maintenance
  const [maintForm, setMaintForm] = useState<VehicleVal>({ year: "", make: "", model: "", mileage: "" });
  const [maintTrigger, setMaintTrigger] = useState(false);

  // ADAS
  const [adasVehicle, setAdasVehicle] = useState<VehicleVal>({ year: "", make: "", model: "" });
  const [adasEvent, setAdasEvent] = useState("");
  const [adasResult, setAdasResult] = useState<AdasResult | null>(null);
  const [adasLoading, setAdasLoading] = useState(false);
  const [adasError, setAdasError] = useState("");

  // Emissions
  const [emissionsState, setEmissionsState] = useState("");
  const [emissionsVehicle, setEmissionsVehicle] = useState<VehicleVal>({ year: "", make: "", model: "" });
  const [incompleteMonitors, setIncompleteMonitors] = useState("");
  const [emissionsResult, setEmissionsResult] = useState<EmissionsResult | null>(null);
  const [emissionsLoading, setEmissionsLoading] = useState(false);
  const [emissionsError, setEmissionsError] = useState("");

  // Safety
  const [safetyForm, setSafetyForm] = useState<VehicleVal>({ year: "", make: "", model: "" });
  const [safetyTrigger, setSafetyTrigger] = useState<"safety" | "complaints" | null>(null);

  // Sync shared vehicle to active tab forms
  useEffect(() => {
    if (vehicle.make) {
      setDtcCode(prev => prev);
      if (!specsVehicle.make) setSpecsVehicle(vehicle);
      if (!freezeVehicle.make) setFreezeVehicle(vehicle);
      if (!patternVehicle.make) setPatternVehicle(vehicle);
      if (!tsbSearch.make) setTsbSearch(vehicle);
      if (!adasVehicle.make) setAdasVehicle(vehicle);
      if (!emissionsVehicle.make) setEmissionsVehicle(vehicle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.make, vehicle.model, vehicle.year]);

  // ── Mutations / Queries ──────────────────────────────────────────────────

  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      setStreamingText(""); setAiResult(null);
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
          } catch { /* ignore partial chunks */ }
        }
      }
      throw new Error("Stream ended without result");
    },
    onSuccess: result => { setAiResult(result); setStreamingText(""); },
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
    onSuccess: d => { setDtcResult(d); setDtcError(""); },
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
    mutationFn: () => axios.post("/api/repair-guide", { ...guideForm, dtcCodes: guideDtcs }).then(r => r.data.guide),
    onSuccess: setGuideResult,
  });

  const maintQuery = useQuery({
    queryKey: ["maintenance-schedule", maintForm.year, maintForm.make, maintForm.model, maintForm.mileage],
    queryFn: () => {
      const p = new URLSearchParams({ make: maintForm.make, model: maintForm.model });
      if (maintForm.year) p.set("year", maintForm.year);
      if (maintForm.mileage) p.set("mileage", maintForm.mileage ?? "");
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

  const freezeMutation = useMutation({
    mutationFn: () => axios.post("/api/freeze-frame", {
      data: freezeData,
      year: freezeVehicle.year, make: freezeVehicle.make, model: freezeVehicle.model,
    }).then(r => r.data),
    onSuccess: d => setFreezeResult(d),
  });

  const patternQuery = useQuery({
    queryKey: ["patterns", patternVehicle.year, patternVehicle.make, patternVehicle.model, patternCode],
    queryFn: () => {
      const p = new URLSearchParams();
      if (patternVehicle.year) p.set("year", patternVehicle.year);
      if (patternVehicle.make) p.set("make", patternVehicle.make);
      if (patternVehicle.model) p.set("model", patternVehicle.model);
      if (patternCode) p.set("code", patternCode);
      return axios.get(`/api/pattern-failures?${p}`).then(r => r.data.failures || []);
    },
    enabled: patternTrigger && !!patternVehicle.make,
  });

  // Keep patternResults updated
  useEffect(() => {
    if (patternQuery.data) setPatternResults(patternQuery.data);
  }, [patternQuery.data]);

  // ── Customer explanation text ─────────────────────────────────────────────
  function buildCustomerText() {
    if (!aiResult) return "";
    const top = aiResult.diagnoses[0];
    const lines = [
      `Hi! Here's a summary of what we found with your ${vehicle.year} ${vehicle.make} ${vehicle.model}:`,
      "",
      `DIAGNOSIS: ${top?.cause || aiResult.summary}`,
      top ? `• ${top.explanation}` : "",
      top ? `• Recommended repair: ${top.repairNeeded}` : "",
      top ? `• Estimated cost: Parts ${top.estimatedPartsCost}, Labor ${top.estimatedLaborCost}` : "",
      aiResult.safetyNotes ? `\nSAFETY NOTE: ${aiResult.safetyNotes}` : "",
      "",
      "Please call us with any questions. We're here to help!",
    ].filter(l => l !== undefined);
    return lines.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  async function handleCreateJob() {
    if (!aiResult || !vehicle.make) return;
    setCreateJobLoading(true);
    setCreateJobSuccess("");
    try {
      const top = aiResult.diagnoses[0];
      const res = await axios.post("/api/jobs", {
        title: top ? `Diagnose & Repair: ${top.cause}` : aiResult.summary,
        description: `AI Diagnosis:\n${aiResult.summary}\n\nSymptoms: ${symptoms}\n\nRecommended: ${top?.repairNeeded || "See diagnosis"}`,
        vehicleYear: vehicle.year, vehicleMake: vehicle.make, vehicleModel: vehicle.model,
        mileage: vehicle.mileage ? Number(vehicle.mileage) : undefined,
        status: "ESTIMATE",
      });
      setCreateJobSuccess(`Job #${res.data.data?.jobNumber || res.data.jobNumber || "created"} — open in Jobs`);
    } catch {
      setCreateJobSuccess("Could not create job — check vehicle/customer fields");
    }
    setCreateJobLoading(false);
  }

  async function handleLookupSpecs() {
    if (!specsVehicle.make) return;
    setSpecsLoading(true); setSpecsError(""); setSpecsResult(null);
    try {
      const p = new URLSearchParams({ make: specsVehicle.make });
      if (specsVehicle.model) p.set("model", specsVehicle.model);
      if (specsVehicle.year) p.set("year", specsVehicle.year);
      const res = await axios.get(`/api/fluid-lookup?${p}`);
      setSpecsResult(res.data);
    } catch {
      setSpecsError("No OEM spec data found for this vehicle in our database.");
    }
    setSpecsLoading(false);
  }

  async function handleAdasLookup() {
    if (!adasVehicle.make || !adasEvent) return;
    setAdasLoading(true); setAdasError(""); setAdasResult(null);
    try {
      const p = new URLSearchParams({ make: adasVehicle.make, event: adasEvent });
      if (adasVehicle.model) p.set("model", adasVehicle.model);
      if (adasVehicle.year) p.set("year", adasVehicle.year);
      const res = await axios.get(`/api/adas-calibration?${p}`);
      setAdasResult(res.data);
    } catch {
      setAdasError("Could not load ADAS calibration data. Check API key and vehicle info.");
    }
    setAdasLoading(false);
  }

  async function handleEmissionsCheck() {
    if (!emissionsState) return;
    setEmissionsLoading(true); setEmissionsError(""); setEmissionsResult(null);
    try {
      const body: Record<string, unknown> = { state: emissionsState };
      if (emissionsVehicle.year) body.year = Number(emissionsVehicle.year);
      if (emissionsVehicle.make) body.make = emissionsVehicle.make;
      if (emissionsVehicle.model) body.model = emissionsVehicle.model;
      if (incompleteMonitors.trim()) body.incompleteMonitors = incompleteMonitors.split(",").map(s => s.trim()).filter(Boolean);
      const res = await axios.post("/api/emissions-readiness", body);
      setEmissionsResult(res.data);
    } catch {
      setEmissionsError("Could not retrieve emissions data.");
    }
    setEmissionsLoading(false);
  }

  async function handleSubmitFix() {
    if (!submitFix.confirmedFix || !patternVehicle.make) return;
    setSubmitFixLoading(true);
    try {
      await axios.post("/api/pattern-failures", {
        year: patternVehicle.year ? Number(patternVehicle.year) : undefined,
        make: patternVehicle.make, model: patternVehicle.model,
        confirmedFix: submitFix.confirmedFix,
        symptoms: submitFix.symptoms ? submitFix.symptoms.split(",").map(s => s.trim()) : [],
        dtcCodes: submitFix.dtcCodes ? submitFix.dtcCodes.split(",").map(s => s.trim().toUpperCase()) : [],
        partNumbers: submitFix.partNumbers ? submitFix.partNumbers.split(",").map(s => s.trim()) : [],
        laborHours: submitFix.laborHours ? Number(submitFix.laborHours) : undefined,
        notes: submitFix.notes,
      });
      setSubmitFixSuccess(true);
      setSubmitFix({ confirmedFix: "", symptoms: "", dtcCodes: "", partNumbers: "", laborHours: "", notes: "" });
      setShowSubmitFix(false);
      setPatternTrigger(false);
      setTimeout(() => setPatternTrigger(true), 100);
    } catch { /* non-fatal */ }
    setSubmitFixLoading(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-blue-600" /> Diagnostic & Repair Center
        </h1>
        <p className="text-sm text-gray-500">
          AI diagnosis · DTC lookup · OEM specs · Freeze frame · Pattern fixes · TSBs · Repair guides · ADAS · Emissions
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 border-b overflow-x-auto pb-0 scrollbar-thin">
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

      {/* ── AI Diagnosis ─────────────────────────────────────────────────── */}
      {tab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Vehicle Information</CardTitle></CardHeader>
              <CardContent>
                <SmartVehicleInputs val={vehicle} set={setVehicle} includeMileage />
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
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={diagJobId} onChange={e => setDiagJobId(e.target.value)}>
                    <option value="">— Don&apos;t save to job —</option>
                    {openJobs.map(j => (
                      <option key={j.id} value={j.id}>#{j.jobNumber} — {j.title} ({j.customer.firstName} {j.customer.lastName})</option>
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
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-40 overflow-auto bg-white/70 rounded p-3 border">{streamingText}</pre>
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
                        <Badge variant="outline" className="text-xs font-mono flex-shrink-0 border-blue-300 text-blue-700">{aiResult.confidence}% confident</Badge>
                      )}
                    </div>
                    {aiResult.safetyNotes && (
                      <div className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded p-2 border border-red-200">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {aiResult.safetyNotes}
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => setShowCustomerText(!showCustomerText)}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1" /> Explain to Customer
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleCreateJob} disabled={createJobLoading || !vehicle.make}>
                        {createJobLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Briefcase className="h-3.5 w-3.5 mr-1" />}
                        Create Job
                      </Button>
                    </div>
                    {createJobSuccess && <p className="text-xs text-green-700 mt-2">{createJobSuccess}</p>}
                    {showCustomerText && (
                      <div className="mt-3 p-3 bg-white rounded border space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-600">Customer-Friendly Explanation</p>
                          <CopyButton text={buildCustomerText()} />
                        </div>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{buildCustomerText()}</pre>
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
                            {d.confidence != null && <Badge variant="outline" className="text-xs font-mono">{d.confidence}%</Badge>}
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

      {/* ── DTC Lookup ────────────────────────────────────────────────────── */}
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
                  <SmartVehicleInputs val={vehicle} set={setVehicle} />
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

      {/* ── Vehicle Specs ─────────────────────────────────────────────────── */}
      {tab === "specs" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-blue-600" /> OEM Vehicle Specifications</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Look up factory-spec fluids, capacities, battery, tires, brakes, and ADAS systems from our OEM database.</p>
              <SmartVehicleInputs val={specsVehicle} set={setSpecsVehicle} />
              <Button onClick={handleLookupSpecs} disabled={!specsVehicle.make || specsLoading}>
                {specsLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</> : <><Database className="h-4 w-4 mr-2" /> Look Up Specs</>}
              </Button>
              {specsError && <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">{specsError}</p>}
            </CardContent>
          </Card>

          {specsResult && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = specsResult as any;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {s.engine && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Cpu className="h-4 w-4 text-gray-600" /> Engine</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.engine && <p><span className="text-gray-500">Engine:</span> <span className="font-medium">{s.engine}</span></p>}
                      {s.oilType && <p><span className="text-gray-500">Oil Type:</span> <span className="font-medium">{s.oilType}</span></p>}
                      {s.oilCapacityQts && <p><span className="text-gray-500">Oil Capacity:</span> <span className="font-medium">{s.oilCapacityQts} qts</span></p>}
                      {s.oilFilterPn && <p><span className="text-gray-500">Oil Filter:</span> <span className="font-mono text-xs">{s.oilFilterPn}</span></p>}
                    </CardContent>
                  </Card>
                )}
                {(s.coolantType || s.coolantCapacityQts) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Thermometer className="h-4 w-4 text-blue-500" /> Cooling System</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.coolantType && <p><span className="text-gray-500">Coolant:</span> <span className="font-medium">{s.coolantType}</span></p>}
                      {s.coolantCapacityQts && <p><span className="text-gray-500">Capacity:</span> <span className="font-medium">{s.coolantCapacityQts} qts</span></p>}
                      {s.thermostatTemp && <p><span className="text-gray-500">Thermostat:</span> <span className="font-medium">{s.thermostatTemp}°F</span></p>}
                    </CardContent>
                  </Card>
                )}
                {(s.transFluidType || s.transFluidQts) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Activity className="h-4 w-4 text-purple-500" /> Transmission</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.transFluidType && <p><span className="text-gray-500">Fluid:</span> <span className="font-medium">{s.transFluidType}</span></p>}
                      {s.transFluidQts && <p><span className="text-gray-500">Capacity:</span> <span className="font-medium">{s.transFluidQts} qts</span></p>}
                      {s.transFluidInterval && <p><span className="text-gray-500">Interval:</span> <span className="font-medium">{s.transFluidInterval} mi</span></p>}
                    </CardContent>
                  </Card>
                )}
                {(s.batteryGroup || s.batteryCca) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Activity className="h-4 w-4 text-yellow-500" /> Battery</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.batteryGroup && <p><span className="text-gray-500">Group:</span> <span className="font-medium">{s.batteryGroup}</span></p>}
                      {s.batteryCca && <p><span className="text-gray-500">CCA:</span> <span className="font-medium">{s.batteryCca}</span></p>}
                      {s.batteryAh && <p><span className="text-gray-500">Ah:</span> <span className="font-medium">{s.batteryAh}</span></p>}
                      {s.batteryLocation && <p><span className="text-gray-500">Location:</span> <span className="font-medium">{s.batteryLocation}</span></p>}
                    </CardContent>
                  </Card>
                )}
                {(s.frontTireSize || s.rearTireSize) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Navigation className="h-4 w-4 text-gray-600" /> Tires & Wheels</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.frontTireSize && <p><span className="text-gray-500">Front:</span> <span className="font-mono font-medium">{s.frontTireSize}</span></p>}
                      {s.rearTireSize && <p><span className="text-gray-500">Rear:</span> <span className="font-mono font-medium">{s.rearTireSize}</span></p>}
                      {s.frontTirePsi && <p><span className="text-gray-500">Front PSI:</span> <span className="font-medium">{s.frontTirePsi} psi</span></p>}
                      {s.rearTirePsi && <p><span className="text-gray-500">Rear PSI:</span> <span className="font-medium">{s.rearTirePsi} psi</span></p>}
                      {s.wheelNutTorque && <p><span className="text-gray-500">Lug Torque:</span> <span className="font-medium text-orange-700">{s.wheelNutTorque} ft-lb</span></p>}
                    </CardContent>
                  </Card>
                )}
                {(s.frontRotorDia || s.padMinMm) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Gauge className="h-4 w-4 text-red-500" /> Brakes</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.frontRotorDia && <p><span className="text-gray-500">Front Rotor:</span> <span className="font-medium">{s.frontRotorDia}&quot;</span></p>}
                      {s.rearRotorDia && <p><span className="text-gray-500">Rear Rotor:</span> <span className="font-medium">{s.rearRotorDia}&quot;</span></p>}
                      {s.padMinMm && <p><span className="text-gray-500">Min Pad:</span> <span className="font-medium">{s.padMinMm}mm</span></p>}
                      {s.brakeFluidType && <p><span className="text-gray-500">Brake Fluid:</span> <span className="font-medium">{s.brakeFluidType}</span></p>}
                    </CardContent>
                  </Card>
                )}
                {(s.sparkPlugPn || s.plugGapIn) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Wrench className="h-4 w-4 text-orange-500" /> Tune-Up</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.sparkPlugPn && <p><span className="text-gray-500">Plug P/N:</span> <span className="font-mono">{s.sparkPlugPn}</span></p>}
                      {s.plugGapIn && <p><span className="text-gray-500">Gap:</span> <span className="font-medium">{s.plugGapIn}&quot;</span></p>}
                      {s.plugIntervalMi && <p><span className="text-gray-500">Interval:</span> <span className="font-medium">{s.plugIntervalMi?.toLocaleString()} mi</span></p>}
                      {s.airFilterPn && <p><span className="text-gray-500">Air Filter:</span> <span className="font-mono text-xs">{s.airFilterPn}</span></p>}
                    </CardContent>
                  </Card>
                )}
                {(s.acRefrigerantType || s.acRefrigerantOz) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Wind className="h-4 w-4 text-cyan-500" /> A/C System</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      {s.acRefrigerantType && <p><span className="text-gray-500">Refrigerant:</span> <span className="font-medium">{s.acRefrigerantType}</span></p>}
                      {s.acRefrigerantOz && <p><span className="text-gray-500">Charge:</span> <span className="font-medium">{s.acRefrigerantOz} oz</span></p>}
                      {s.acOilType && <p><span className="text-gray-500">Oil Type:</span> <span className="font-medium">{s.acOilType}</span></p>}
                    </CardContent>
                  </Card>
                )}
                {s.adasFeatures?.length > 0 && (
                  <Card className="md:col-span-2 xl:col-span-3">
                    <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Crosshair className="h-4 w-4 text-indigo-500" /> ADAS Systems</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {s.adasFeatures.map((f: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                      {s.timingChainOrBelt && (
                        <p className={`mt-3 text-sm font-medium ${s.timingChainOrBelt === "belt" ? "text-red-700" : "text-green-700"}`}>
                          {s.timingChainOrBelt === "belt" ? "⚠ Timing Belt — check replacement interval" : "✓ Timing Chain — no scheduled replacement"}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Freeze Frame ──────────────────────────────────────────────────── */}
      {tab === "freeze" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Thermometer className="h-4 w-4 text-blue-600" /> Freeze Frame AI Interpreter</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-gray-500">Paste your OBD-II freeze frame data (JSON, key=value, or plain text) and let AI explain every PID reading and identify root causes.</p>
                <SmartVehicleInputs val={freezeVehicle} set={setFreezeVehicle} />
                <div className="space-y-1">
                  <Label className="text-xs">Freeze Frame Data *</Label>
                  <Textarea
                    rows={10}
                    className="font-mono text-xs"
                    placeholder={`Paste freeze frame data here, e.g.:\nRPM: 1250\nVehicle Speed: 0 mph\nEngine Coolant Temp: 195°F\nMAF: 3.21 g/s\nFuel Trim (ST): -8%\nFuel Trim (LT): -12%\nO2 Sensor B1S1: 0.87V\nThrottle Position: 15%\nDTC Triggered: P0171`}
                    value={freezeData}
                    onChange={e => setFreezeData(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={() => freezeMutation.mutate()} disabled={!freezeData.trim() || freezeMutation.isPending}>
                  {freezeMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Interpreting...</> : <><Brain className="h-4 w-4 mr-2" /> Interpret Freeze Frame</>}
                </Button>
                {freezeMutation.isError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">Failed to interpret. Check API key.</p>}
              </CardContent>
            </Card>
          </div>
          <div>
            {!freezeResult && !freezeMutation.isPending && (
              <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
                <Thermometer className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Paste freeze frame data to interpret</p>
                <p className="text-sm mt-1">AI explains abnormal readings and root causes</p>
              </div>
            )}
            {freezeMutation.isPending && (
              <div className="p-12 text-center border-2 border-blue-200 rounded-lg bg-blue-50 text-blue-600">
                <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin" />
                <p className="font-medium">AI is analyzing freeze frame data...</p>
              </div>
            )}
            {freezeResult && (
              <div className="space-y-4">
                <Card className={`border-2 ${freezeResult.urgency === "immediate" ? "border-red-300 bg-red-50" : freezeResult.urgency === "high" ? "border-orange-300 bg-orange-50" : "border-blue-200 bg-blue-50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{freezeResult.summary}</p>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge className={freezeResult.urgency === "immediate" ? "bg-red-100 text-red-700" : freezeResult.urgency === "high" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}>
                          {freezeResult.urgency?.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className={freezeResult.driveable ? "text-green-700" : "text-red-700"}>
                          {freezeResult.driveable ? "Driveable" : "Do Not Drive"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {freezeResult.abnormalReadings?.length > 0 && (
                  <Card className="border-orange-200">
                    <CardHeader><CardTitle className="text-sm text-orange-700">Abnormal Readings</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {freezeResult.abnormalReadings.map((r, i) => (
                        <div key={i} className="bg-orange-50 rounded p-2 border border-orange-100">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-bold text-orange-800">{r.pid}</span>
                            <span className="text-sm font-medium text-red-700">{r.value}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">Normal: {r.normal}</p>
                          <p className="text-xs text-gray-700 mt-1">{r.significance}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {freezeResult.rootCauses?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Root Causes</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {freezeResult.rootCauses.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-xs font-bold bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          {c}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {freezeResult.diagnosticSteps?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Recommended Diagnostic Steps</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {freezeResult.diagnosticSteps.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> {s}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pattern Failures ──────────────────────────────────────────────── */}
      {tab === "patterns" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" /> Confirmed Pattern Fix Database</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Identifix-style database of confirmed fixes submitted by technicians. Ranked by success count.</p>
              <SmartVehicleInputs val={patternVehicle} set={setPatternVehicle} />
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Filter by DTC (optional)</Label>
                  <Input className="font-mono" placeholder="P0420" value={patternCode} onChange={e => setPatternCode(e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setPatternTrigger(false); setTimeout(() => setPatternTrigger(true), 50); }} disabled={!patternVehicle.make || patternQuery.isFetching}>
                  <Search className="h-4 w-4 mr-2" />{patternQuery.isFetching ? "Searching..." : "Search Fixes"}
                </Button>
                <Button variant="outline" onClick={() => setShowSubmitFix(!showSubmitFix)}>
                  <Plus className="h-4 w-4 mr-2" /> Submit a Fix
                </Button>
              </div>
            </CardContent>
          </Card>

          {showSubmitFix && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader><CardTitle className="text-sm text-green-800">Submit a Confirmed Fix</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Confirmed Fix * (what fixed it)</Label>
                    <Input placeholder="Replaced MAF sensor and cleaned throttle body" value={submitFix.confirmedFix} onChange={e => setSubmitFix({ ...submitFix, confirmedFix: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Symptoms (comma-separated)</Label>
                    <Input placeholder="rough idle, hesitation" value={submitFix.symptoms} onChange={e => setSubmitFix({ ...submitFix, symptoms: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">DTC Codes (comma-separated)</Label>
                    <Input className="font-mono" placeholder="P0101, P0300" value={submitFix.dtcCodes} onChange={e => setSubmitFix({ ...submitFix, dtcCodes: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Part Numbers (comma-separated)</Label>
                    <Input placeholder="22680-7S000" value={submitFix.partNumbers} onChange={e => setSubmitFix({ ...submitFix, partNumbers: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Labor Hours</Label>
                    <Input type="number" placeholder="1.5" value={submitFix.laborHours} onChange={e => setSubmitFix({ ...submitFix, laborHours: e.target.value })} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input placeholder="Reset adaptations after repair, road test 10 miles" value={submitFix.notes} onChange={e => setSubmitFix({ ...submitFix, notes: e.target.value })} />
                  </div>
                </div>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleSubmitFix} disabled={!submitFix.confirmedFix || submitFixLoading}>
                  {submitFixLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : "Submit Fix"}
                </Button>
                {submitFixSuccess && <p className="text-sm text-green-700">Fix submitted! Thank you for contributing.</p>}
              </CardContent>
            </Card>
          )}

          {patternQuery.isFetching && (
            <div className="p-8 text-center text-green-600"><Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" /><p>Searching pattern database...</p></div>
          )}

          {patternResults.length === 0 && patternTrigger && !patternQuery.isFetching && (
            <Card><CardContent className="p-4 text-sm text-gray-500 text-center">No confirmed fixes found for this vehicle in our database yet. Be the first to submit one!</CardContent></Card>
          )}

          <div className="space-y-3">
            {patternResults.map(p => (
              <Card key={p.id} className="border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{p.confirmedFix}</p>
                      <p className="text-xs text-gray-500 mt-1">{p.year} {p.make} {p.model}{p.engine ? ` • ${p.engine}` : ""}</p>
                      {p.dtcCodes?.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          {p.dtcCodes.map(c => <span key={c} className="font-mono text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{c}</span>)}
                        </div>
                      )}
                      {p.symptoms?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1.5">Symptoms: {p.symptoms.join(", ")}</p>
                      )}
                      {p.partNumbers?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">Parts: <span className="font-mono">{p.partNumbers.join(", ")}</span></p>
                      )}
                      {p.notes && <p className="text-xs text-gray-600 italic mt-1.5">{p.notes}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        {p.successCount}× confirmed
                      </Badge>
                      {p.laborHours && <span className="text-xs text-gray-400">{p.laborHours}h labor</span>}
                      <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── TSB Database ──────────────────────────────────────────────────── */}
      {tab === "tsb" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" /> Technical Service Bulletins (NHTSA Database)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">TSBs are manufacturer-issued repair instructions for known issues. Data sourced directly from NHTSA.</p>
              <SmartVehicleInputs val={tsbSearch} set={setTsbSearch} />
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
                <h3 className="font-semibold text-gray-800">{tsbQuery.data.count} TSBs found for {tsbSearch.year} {tsbSearch.make} {tsbSearch.model}</h3>
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
                        <div className="mt-3 pt-3 border-t text-sm text-gray-700 bg-gray-50 rounded p-3">{tsb.summary}</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Repair Guide ─────────────────────────────────────────────────── */}
      {tab === "guide" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-green-600" /> AI Repair Guide Generator</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-500">Generate professional step-by-step repair procedures with torque specs, tools, and parts lists.</p>
                  <SmartVehicleInputs val={guideForm} set={v => setGuideForm({ ...guideForm, ...v })} includeMileage />
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
                  {guideMutation.isError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{(guideMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to generate guide."}</p>}
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
                      <CardContent className="space-y-1">{guideResult.safetyWarnings.map((w, i) => <p key={i} className="text-sm text-red-700">⚠ {w}</p>)}</CardContent>
                    </Card>
                  )}
                  {guideResult.toolsRequired?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Tools Required</CardTitle></CardHeader>
                      <CardContent><div className="flex flex-wrap gap-2">{guideResult.toolsRequired.map((t, i) => (<div key={i} className="px-2 py-1 bg-gray-100 rounded text-sm"><span className="font-medium">{t.tool}</span>{t.notes && <span className="text-gray-500 text-xs ml-1">({t.notes})</span>}</div>))}</div></CardContent>
                    </Card>
                  )}
                  {guideResult.partsRequired?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Parts Required</CardTitle></CardHeader>
                      <CardContent><div className="space-y-2">{guideResult.partsRequired.map((p, i) => (<div key={i} className="flex justify-between text-sm border-b last:border-0 pb-1"><div><span className="font-medium">{p.part}</span>{p.partNumber && <span className="text-xs text-gray-400 ml-2 font-mono">#{p.partNumber}</span>}<span className="text-xs text-gray-500 ml-2">×{p.qty}</span></div>{p.estimatedCost && <span className="text-green-700 font-medium">{p.estimatedCost}</span>}</div>))}</div></CardContent>
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
                              {s.torqueSpec && <p className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-2 py-0.5 mt-1 inline-block">Torque: {s.torqueSpec}</p>}
                              {s.tip && <p className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 mt-1">Tip: {s.tip}</p>}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {guideResult.torqueSpecs?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Torque Specifications</CardTitle></CardHeader>
                      <CardContent><div className="space-y-1">{guideResult.torqueSpecs.map((t, i) => (<div key={i} className="flex justify-between text-sm border-b last:border-0 pb-1"><span className="text-gray-700">{t.component}</span><span className="font-mono font-medium text-orange-700">{t.spec}</span></div>))}</div></CardContent>
                    </Card>
                  )}
                  {guideResult.commonMistakes?.length > 0 && (
                    <Card className="border-orange-200">
                      <CardHeader><CardTitle className="text-sm text-orange-700">Common Mistakes to Avoid</CardTitle></CardHeader>
                      <CardContent className="space-y-1">{guideResult.commonMistakes.map((m, i) => <p key={i} className="text-sm text-gray-700">✗ {m}</p>)}</CardContent>
                    </Card>
                  )}
                  {guideResult.proTips?.length > 0 && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader><CardTitle className="text-sm text-blue-700">Pro Tips</CardTitle></CardHeader>
                      <CardContent className="space-y-1">{guideResult.proTips.map((t, i) => <p key={i} className="text-sm text-blue-800">✓ {t}</p>)}</CardContent>
                    </Card>
                  )}
                  {guideResult.postRepairChecks?.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Post-Repair Verification</CardTitle></CardHeader>
                      <CardContent className="space-y-1">{guideResult.postRepairChecks.map((c, i) => (<div key={i} className="flex items-start gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> {c}</div>))}</CardContent>
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

      {/* ── Maintenance Schedule ─────────────────────────────────────────── */}
      {tab === "maintenance" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-600" /> AI Maintenance Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Get a complete, vehicle-specific maintenance schedule with manufacturer-recommended intervals.</p>
              <SmartVehicleInputs val={maintForm} set={setMaintForm} includeMileage />
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
                          {status === "overdue" ? "Overdue" : status === "due_soon" ? "Due Soon" : "Up to Date"}
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

      {/* ── ADAS Calibration ─────────────────────────────────────────────── */}
      {tab === "adas" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Crosshair className="h-4 w-4 text-indigo-600" /> ADAS Calibration Requirements</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Get AI-generated calibration procedures for Advanced Driver Assistance Systems (forward cameras, radar, lane keep, blind spot, etc.) after common repair events.</p>
              <SmartVehicleInputs val={adasVehicle} set={setAdasVehicle} />
              <div className="space-y-1">
                <Label className="text-xs">Repair Event *</Label>
                <select className="w-full border rounded-md px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={adasEvent} onChange={e => setAdasEvent(e.target.value)}>
                  {ADAS_EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleAdasLookup} disabled={!adasVehicle.make || !adasEvent || adasLoading}>
                {adasLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</> : <><Crosshair className="h-4 w-4 mr-2" /> Get Calibration Procedures</>}
              </Button>
              {adasError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{adasError}</p>}
            </CardContent>
          </Card>

          {!adasResult && !adasLoading && (
            <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
              <Crosshair className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Select vehicle and repair event</p>
              <p className="text-sm mt-1">Covers cameras, radar, ultrasonic sensors, and more</p>
            </div>
          )}

          {adasResult && (
            <div className="space-y-4">
              <Card className="border-indigo-200 bg-indigo-50">
                <CardContent className="p-4">
                  <p className="font-semibold text-indigo-900">{adasResult.vehicle} — {adasResult.event?.replace(/_/g, " ")}</p>
                  {adasResult.systems?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {adasResult.systems.map((s, i) => <Badge key={i} variant="outline" className="text-xs border-indigo-300 text-indigo-700">{s}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>

              {(adasResult.calibrations || []).map((cal, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{cal.system}</span>
                      <Badge variant="outline" className="text-xs">{cal.type}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cal.requirements?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Requirements</p>
                        <ul className="space-y-1">
                          {cal.requirements.map((r, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" /> {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {cal.procedure && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Procedure</p>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded p-2 border">{cal.procedure}</p>
                      </div>
                    )}
                    {cal.notes && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">{cal.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Emissions Readiness ──────────────────────────────────────────── */}
      {tab === "emissions" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wind className="h-4 w-4 text-green-600" /> Emissions Readiness Check</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Look up state-specific OBD emissions requirements and check if a vehicle will pass based on its readiness monitors.</p>
              <div className="space-y-1">
                <Label className="text-xs">State *</Label>
                <select className="w-full border rounded-md px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={emissionsState} onChange={e => setEmissionsState(e.target.value)}>
                  <option value="">Select state...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <SmartVehicleInputs val={emissionsVehicle} set={setEmissionsVehicle} />
              <div className="space-y-1">
                <Label className="text-xs">Incomplete OBD Monitors (optional, comma-separated)</Label>
                <Input placeholder="e.g. Catalyst, Evap, O2 Sensor" value={incompleteMonitors} onChange={e => setIncompleteMonitors(e.target.value)} />
                <p className="text-xs text-gray-400">Leave blank to just look up state requirements</p>
              </div>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleEmissionsCheck} disabled={!emissionsState || emissionsLoading}>
                {emissionsLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</> : <><Wind className="h-4 w-4 mr-2" /> Check Emissions Readiness</>}
              </Button>
              {emissionsError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{emissionsError}</p>}
            </CardContent>
          </Card>

          {emissionsResult && (
            <div className="space-y-4">
              <Card className={`border-2 ${emissionsResult.requiresObd ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                <CardContent className="p-4">
                  <p className="font-semibold text-gray-900">{emissionsResult.state} — Emissions Requirements</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="text-gray-500">OBD Test Required:</span> <span className={`font-medium ${emissionsResult.requiresObd ? "text-blue-700" : "text-gray-600"}`}>{emissionsResult.requiresObd ? "Yes" : "No"}</span></p>
                    {emissionsResult.cutoffYear && <p><span className="text-gray-500">Applies to vehicles:</span> <span className="font-medium">{emissionsResult.cutoffYear} and newer</span></p>}
                    {emissionsResult.exemptMileage && <p><span className="text-gray-500">Exempt if mileage under:</span> <span className="font-medium">{emissionsResult.exemptMileage.toLocaleString()} miles</span></p>}
                    {emissionsResult.notes && <p className="text-xs text-gray-600 mt-2 bg-white rounded p-2 border">{emissionsResult.notes}</p>}
                  </div>
                </CardContent>
              </Card>

              {emissionsResult.analysis && (
                <Card className={`border-2 ${emissionsResult.analysis.readyForTest ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Readiness Analysis</span>
                      <Badge className={emissionsResult.analysis.readyForTest ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {emissionsResult.analysis.readyForTest ? "READY TO TEST" : "NOT READY"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm font-medium">{emissionsResult.analysis.readinessStatus}</p>
                    {emissionsResult.analysis.incompleteMonitors?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-700 mb-1">Incomplete Monitors</p>
                        <div className="flex flex-wrap gap-1">
                          {emissionsResult.analysis.incompleteMonitors.map((m, i) => <Badge key={i} className="bg-red-100 text-red-700 text-xs">{m}</Badge>)}
                        </div>
                      </div>
                    )}
                    {emissionsResult.analysis.driveCycle?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Drive Cycle to Complete Monitors</p>
                        <ol className="space-y-1">
                          {emissionsResult.analysis.driveCycle.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-xs font-bold bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <p className="text-sm text-gray-700 bg-white rounded p-2 border">{emissionsResult.analysis.recommendation}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Safety & Complaints ──────────────────────────────────────────── */}
      {tab === "safety" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-blue-600" /> NHTSA Safety Data</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Official safety ratings and owner complaints from the NHTSA database.</p>
              <SmartVehicleInputs val={safetyForm} set={setSafetyForm} />
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

          {complaintsQuery.data && !complaintsQuery.isFetching && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{complaintsQuery.data.count} Owner Complaints — {safetyForm.year} {safetyForm.make} {safetyForm.model}</h3>
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
                {complaintsQuery.data.complaints?.slice(0, 20).map((c: { id?: string; component?: string; dateFiled?: string; summary?: string; crash?: boolean; injury?: boolean }, i: number) => (
                  <Card key={c.id || i} className={c.crash || c.injury ? "border-red-200" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{c.component || "General"}</Badge>
                        {c.crash && <Badge className="bg-red-100 text-red-700 text-xs">Crash</Badge>}
                        {c.injury && <Badge className="bg-orange-100 text-orange-700 text-xs">Injury</Badge>}
                        {c.dateFiled && <span className="text-xs text-gray-400">{new Date(c.dateFiled).toLocaleDateString()}</span>}
                      </div>
                      <p className="text-sm text-gray-700 mt-1 leading-relaxed">{c.summary}</p>
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
