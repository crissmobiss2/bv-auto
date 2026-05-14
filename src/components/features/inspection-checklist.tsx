"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, AlertTriangle, MinusCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const CONDITIONS = [
  { value: "GOOD", label: "Good", icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "FAIR", label: "Fair", icon: AlertCircle, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  { value: "NEEDS_ATTENTION", label: "Attention", icon: AlertTriangle, color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "CRITICAL", label: "Critical", icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "NA", label: "N/A", icon: MinusCircle, color: "text-gray-400 bg-gray-50 border-gray-200" },
];

type ChecklistItem = {
  id: string;
  category: string;
  item: string;
  condition: string;
  notes?: string;
};

type InspectionData = {
  completedAt?: string;
  completedBy?: string;
  mileage?: number;
  items: ChecklistItem[];
  technicianNotes?: string;
  recommendedServices?: string[];
};

type DefaultItem = { id: string; category: string; item: string };

export function InspectionChecklist({ job }: { job: { id: string; mileageIn?: number; checklist?: InspectionData } }) {
  const queryClient = useQueryClient();

  const { data: inspectionData } = useQuery({
    queryKey: ["inspection", job.id],
    queryFn: () => axios.get(`/api/jobs/${job.id}/inspection`).then((r) => r.data),
  });

  const defaultItems: DefaultItem[] = inspectionData?.defaultItems || [];
  const savedChecklist: InspectionData | null = inspectionData?.checklist || null;

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [mileage, setMileage] = useState(job.mileageIn?.toString() || "");
  const [techNotes, setTechNotes] = useState("");
  const [completed, setCompleted] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (savedChecklist) {
      setItems(savedChecklist.items || []);
      setMileage(savedChecklist.mileage?.toString() || "");
      setTechNotes(savedChecklist.technicianNotes || "");
      setCompleted(true);
    } else if (defaultItems.length > 0) {
      setItems(defaultItems.map((d) => ({ ...d, condition: "GOOD", notes: "" })));
    }
  }, [inspectionData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/jobs/${job.id}/inspection`, {
        mileage: mileage ? parseInt(mileage) : undefined,
        items,
        technicianNotes: techNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection", job.id] });
      setCompleted(true);
    },
  });

  const sendReportMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${job.id}/inspection/send`),
    onSuccess: () => alert("Inspection report sent to customer."),
  });

  const updateItem = (id: string, field: "condition" | "notes", value: string) => {
    setItems(items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const categories = Array.from(new Set(items.map((i) => i.category)));

  const conditionSummary = {
    CRITICAL: items.filter((i) => i.condition === "CRITICAL").length,
    NEEDS_ATTENTION: items.filter((i) => i.condition === "NEEDS_ATTENTION").length,
    FAIR: items.filter((i) => i.condition === "FAIR").length,
    GOOD: items.filter((i) => i.condition === "GOOD").length,
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {completed && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: "CRITICAL", label: "Critical", count: conditionSummary.CRITICAL, bg: "bg-red-50 border-red-200 text-red-700" },
            { key: "NEEDS_ATTENTION", label: "Attention", count: conditionSummary.NEEDS_ATTENTION, bg: "bg-orange-50 border-orange-200 text-orange-700" },
            { key: "FAIR", label: "Fair", count: conditionSummary.FAIR, bg: "bg-yellow-50 border-yellow-200 text-yellow-700" },
            { key: "GOOD", label: "Good", count: conditionSummary.GOOD, bg: "bg-green-50 border-green-200 text-green-700" },
          ].map(({ key, label, count, bg }) => (
            <div key={key} className={`rounded-lg border p-3 text-center ${bg}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Vehicle Inspection</CardTitle>
          <div className="flex gap-2">
            {completed && (
              <Button size="sm" variant="outline" onClick={() => sendReportMutation.mutate()}>
                <Send className="h-4 w-4 mr-1" /> Send to Customer
              </Button>
            )}
            {completed && (
              <Button size="sm" variant="outline" onClick={() => setCompleted(false)}>Edit</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mileage</Label>
              <Input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                disabled={completed}
                placeholder="Current mileage"
              />
            </div>
          </div>

          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">{category}</h3>
              <div className="space-y-2">
                {items.filter((i) => i.category === category).map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4 text-sm text-gray-700">{item.item}</div>
                    <div className="col-span-4">
                      {completed ? (
                        <span className={cn("text-xs rounded-md px-2 py-1 font-medium border",
                          CONDITIONS.find(c => c.value === item.condition)?.color
                        )}>
                          {CONDITIONS.find(c => c.value === item.condition)?.label || item.condition}
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          {CONDITIONS.map((c) => (
                            <button
                              key={c.value}
                              onClick={() => updateItem(item.id, "condition", c.value)}
                              className={cn(
                                "text-xs px-2 py-1 rounded border transition-colors",
                                item.condition === c.value ? c.color : "text-gray-400 border-gray-200 hover:bg-gray-50"
                              )}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-4">
                      <Input
                        className="h-7 text-xs"
                        placeholder="Notes..."
                        value={item.notes || ""}
                        onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                        disabled={completed}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Technician Notes</Label>
            <Textarea
              rows={3}
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              disabled={completed}
              placeholder="Summary, recommendations, additional observations..."
            />
          </div>

          {!completed && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? "Saving..." : "Complete Inspection"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
