"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Camera,
} from "lucide-react";

type Condition = "GOOD" | "NEEDS_ATTENTION" | "CRITICAL" | "FAIR" | "NA";

type ChecklistItem = {
  id: string;
  category: string;
  item: string;
  condition: Condition;
  notes?: string;
  photoUrls?: string[];
};

type InspectionData = {
  completedAt?: string;
  mileage?: number;
  items: ChecklistItem[];
  technicianNotes?: string;
};

type Job = {
  id: string;
  title: string;
  mileageIn?: number;
  vehicle: { year: number; make: string; model: string };
  customer: { firstName: string; lastName: string };
};

const CONDITION_STYLES: Record<Condition, string> = {
  GOOD: "bg-green-500 text-white",
  NEEDS_ATTENTION: "bg-orange-500 text-white",
  CRITICAL: "bg-red-600 text-white",
  FAIR: "bg-yellow-500 text-white",
  NA: "bg-gray-200 text-gray-600",
};

const CONDITION_LABELS: Record<Condition, string> = {
  GOOD: "Good",
  NEEDS_ATTENTION: "Needs Attention",
  CRITICAL: "Critical",
  FAIR: "Fair",
  NA: "N/A",
};

const CONDITION_INACTIVE =
  "bg-gray-50 text-gray-400 border border-gray-200";

const CONDITIONS: Condition[] = ["GOOD", "FAIR", "NEEDS_ATTENTION", "CRITICAL", "NA"];

function conditionIcon(c: Condition) {
  if (c === "GOOD") return <CheckCircle className="h-3.5 w-3.5" />;
  if (c === "CRITICAL") return <XCircle className="h-3.5 w-3.5" />;
  if (c === "NEEDS_ATTENTION" || c === "FAIR")
    return <AlertTriangle className="h-3.5 w-3.5" />;
  return null;
}

export default function TechInspectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["inspection", id],
    queryFn: () =>
      axios.get(`/api/jobs/${id}/inspection`).then((r) => r.data),
  });

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [mileage, setMileage] = useState("");
  const [techNotes, setTechNotes] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sendSent, setSendSent] = useState(false);

  const job: Job | undefined = data?.job;
  const savedChecklist: InspectionData | null = data?.checklist || null;

  useEffect(() => {
    if (savedChecklist) {
      setItems(savedChecklist.items || []);
      setMileage(savedChecklist.mileage?.toString() || "");
      setTechNotes(savedChecklist.technicianNotes || "");
      setSubmitted(true);
    } else if (data?.defaultItems?.length) {
      const defaults: ChecklistItem[] = data.defaultItems.map(
        (d: { id: string; category: string; item: string }) => ({
          ...d,
          condition: "GOOD" as Condition,
          notes: "",
        })
      );
      setItems(defaults);
      // Open all categories by default
      const cats = Array.from(new Set(defaults.map((i) => i.category))) as string[];
      const openAll: Record<string, boolean> = {};
      cats.forEach((c) => (openAll[c] = true));
      setOpenCategories(openAll);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/jobs/${id}/inspection`, {
        mileage: mileage ? parseInt(mileage) : undefined,
        items,
        technicianNotes: techNotes,
      }),
    onSuccess: () => setSubmitted(true),
  });

  const sendMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${id}/inspection/send`),
    onSuccess: () => setSendSent(true),
  });

  const updateItem = (itemId: string, field: "condition" | "notes", value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const ratedCount = items.filter((i) => i.condition).length;
  const totalCount = items.length;

  const summary = {
    GOOD: items.filter((i) => i.condition === "GOOD").length,
    FAIR: items.filter((i) => i.condition === "FAIR").length,
    NEEDS_ATTENTION: items.filter((i) => i.condition === "NEEDS_ATTENTION").length,
    CRITICAL: items.filter((i) => i.condition === "CRITICAL").length,
    NA: items.filter((i) => i.condition === "NA").length,
  };

  // --- Summary screen after submit ---
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">Inspection Complete</p>
            {job && (
              <p className="text-xs text-gray-500 truncate">
                {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "CRITICAL", label: "Critical", bg: "bg-red-50 border-red-200 text-red-700" },
              { key: "NEEDS_ATTENTION", label: "Needs Attention", bg: "bg-orange-50 border-orange-200 text-orange-700" },
              { key: "FAIR", label: "Fair", bg: "bg-yellow-50 border-yellow-200 text-yellow-700" },
              { key: "GOOD", label: "Good", bg: "bg-green-50 border-green-200 text-green-700" },
            ].map(({ key, label, bg }) => (
              <div key={key} className={`rounded-xl border p-4 text-center ${bg}`}>
                <p className="text-3xl font-bold">{summary[key as keyof typeof summary]}</p>
                <p className="text-xs font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {mileage && (
            <Card>
              <CardContent className="p-4 text-sm text-gray-700">
                <span className="font-medium">Mileage recorded: </span>
                {parseInt(mileage).toLocaleString()} mi
              </CardContent>
            </Card>
          )}

          {/* Item list by category */}
          {categories.map((cat) => (
            <Card key={cat}>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">{cat}</p>
                <div className="space-y-2">
                  {items
                    .filter((i) => i.category === cat)
                    .map((item) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${CONDITION_STYLES[item.condition]}`}
                        >
                          {conditionIcon(item.condition)}
                          {CONDITION_LABELS[item.condition]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800">{item.item}</p>
                          {item.notes && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sticky bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 space-y-2 shadow-lg">
          {sendSent ? (
            <div className="flex items-center justify-center gap-2 py-2 text-green-600 font-medium text-sm">
              <CheckCircle className="h-5 w-5" />
              Report sent to customer
            </div>
          ) : (
            <Button
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Send to Customer
                </>
              )}
            </Button>
          )}
          <button
            onClick={() => setSubmitted(false)}
            className="w-full text-sm text-gray-500 py-1"
          >
            Edit Inspection
          </button>
        </div>
      </div>
    );
  }

  // --- Main inspection form ---
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">Vehicle Inspection</p>
          {job && (
            <p className="text-xs text-gray-500 truncate">
              {job.vehicle.year} {job.vehicle.make} {job.vehicle.model} ·{" "}
              {job.customer.firstName} {job.customer.lastName}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Mileage */}
        <Card>
          <CardContent className="p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Mileage
            </label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 85000"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              className="text-lg h-12"
            />
          </CardContent>
        </Card>

        {/* Categories accordion */}
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category === cat);
          const isOpen = openCategories[cat] ?? true;
          const critCount = catItems.filter((i) => i.condition === "CRITICAL").length;
          const attnCount = catItems.filter((i) => i.condition === "NEEDS_ATTENTION").length;

          return (
            <Card key={cat}>
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-sm text-gray-900">{cat}</span>
                  <span className="text-xs text-gray-400">
                    {catItems.length} items
                  </span>
                  {critCount > 0 && (
                    <span className="text-xs font-bold text-red-600">
                      {critCount} critical
                    </span>
                  )}
                  {attnCount > 0 && (
                    <span className="text-xs font-bold text-orange-600">
                      {attnCount} attention
                    </span>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {isOpen && (
                <CardContent className="px-4 pb-4 pt-0 space-y-4 border-t">
                  {catItems.map((item) => {
                    const needsNote =
                      item.condition === "NEEDS_ATTENTION" ||
                      item.condition === "CRITICAL";
                    return (
                      <div key={item.id} className="space-y-2 pt-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 flex-1">
                            {item.item}
                          </p>
                          <Camera className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                        </div>
                        {/* Condition buttons */}
                        <div className="flex flex-wrap gap-2">
                          {CONDITIONS.map((cond) => (
                            <button
                              key={cond}
                              onClick={() => updateItem(item.id, "condition", cond)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all min-h-[44px] ${
                                item.condition === cond
                                  ? CONDITION_STYLES[cond]
                                  : CONDITION_INACTIVE
                              }`}
                            >
                              {item.condition === cond && conditionIcon(cond)}
                              {CONDITION_LABELS[cond]}
                            </button>
                          ))}
                        </div>
                        {/* Notes — only shown for flagged conditions */}
                        {needsNote && (
                          <Textarea
                            placeholder="Describe the issue..."
                            value={item.notes || ""}
                            onChange={(e) =>
                              updateItem(item.id, "notes", e.target.value)
                            }
                            rows={2}
                            className="text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Technician notes */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Technician Notes
            </label>
            <Textarea
              placeholder="Overall summary, recommendations..."
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <span className="text-sm text-gray-500">
              <span className={`font-bold ${ratedCount === totalCount ? "text-green-600" : "text-gray-900"}`}>
                {ratedCount}
              </span>
              <span className="text-gray-400">/{totalCount}</span>{" "}
              items rated
            </span>
          </div>
          <Button
            className="flex-1 h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || items.length === 0}
          >
            {saveMutation.isPending ? (
              "Saving..."
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Complete Inspection
              </>
            )}
          </Button>
        </div>
        {saveMutation.isError && (
          <p className="text-xs text-red-600 mt-2 text-center">
            Failed to save. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
