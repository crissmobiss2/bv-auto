"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Printer, ClipboardCheck, CheckCircle } from "lucide-react";
import { useState } from "react";

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
  completedBy?: string;
  mileage?: number;
  items: ChecklistItem[];
  technicianNotes?: string;
  recommendedServices?: string[];
};

const CONDITION_STYLES: Record<Condition, string> = {
  GOOD: "bg-green-500 text-white border-transparent",
  NEEDS_ATTENTION: "bg-orange-500 text-white border-transparent",
  CRITICAL: "bg-red-600 text-white border-transparent",
  FAIR: "bg-yellow-500 text-white border-transparent",
  NA: "bg-gray-200 text-gray-600 border-transparent",
};

const CONDITION_LABELS: Record<Condition, string> = {
  GOOD: "Good",
  NEEDS_ATTENTION: "Needs Attention",
  CRITICAL: "Critical",
  FAIR: "Fair",
  NA: "N/A",
};

const SUMMARY_CARD_STYLES = {
  CRITICAL: "bg-red-50 border-red-200 text-red-700",
  NEEDS_ATTENTION: "bg-orange-50 border-orange-200 text-orange-700",
  FAIR: "bg-yellow-50 border-yellow-200 text-yellow-700",
  GOOD: "bg-green-50 border-green-200 text-green-700",
  NA: "bg-gray-50 border-gray-200 text-gray-500",
};

export default function DashboardInspectionPage() {
  const { id } = useParams<{ id: string }>();
  const [sendSent, setSendSent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inspection", id],
    queryFn: () =>
      axios.get(`/api/jobs/${id}/inspection`).then((r) => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${id}/inspection/send`),
    onSuccess: () => setSendSent(true),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-500">
        Loading inspection...
      </div>
    );

  const checklist: InspectionData | null = data?.checklist || null;
  const job = data?.job;

  // --- Empty state ---
  if (!checklist) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/jobs/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vehicle Inspection</h1>
            {job && (
              <p className="text-sm text-gray-500">
                {job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}
              </p>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-gray-700">No inspection completed yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Send the technician to complete the DVI first.
              </p>
            </div>
            <Link href={`/tech/jobs/${id}/inspection`}>
              <Button variant="outline" className="mt-2">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Open Tech Inspection Form
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items: ChecklistItem[] = checklist.items || [];
  const categories = Array.from(new Set(items.map((i) => i.category)));

  const summary = {
    CRITICAL: items.filter((i) => i.condition === "CRITICAL").length,
    NEEDS_ATTENTION: items.filter((i) => i.condition === "NEEDS_ATTENTION").length,
    FAIR: items.filter((i) => i.condition === "FAIR").length,
    GOOD: items.filter((i) => i.condition === "GOOD").length,
    NA: items.filter((i) => i.condition === "NA").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/jobs/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">Vehicle Inspection</h1>
            {checklist.completedAt && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed {new Date(checklist.completedAt).toLocaleDateString()}
              </Badge>
            )}
          </div>
          {job && (
            <p className="text-sm text-gray-500 mt-0.5">
              {job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model} ·{" "}
              {job.customer?.firstName} {job.customer?.lastName}
            </p>
          )}
          {checklist.mileage && (
            <p className="text-sm text-gray-500">
              Mileage: {checklist.mileage.toLocaleString()} mi
            </p>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          {sendSent ? (
            <Button size="sm" variant="outline" disabled className="text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              Sent
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send to Customer
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["CRITICAL", "NEEDS_ATTENTION", "FAIR", "GOOD"] as const).map((key) => (
          <div
            key={key}
            className={`rounded-xl border p-4 text-center ${SUMMARY_CARD_STYLES[key]}`}
          >
            <p className="text-3xl font-bold">{summary[key]}</p>
            <p className="text-xs font-semibold mt-0.5">{CONDITION_LABELS[key]}</p>
          </div>
        ))}
      </div>

      {/* Items grouped by category */}
      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">{cat}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y">
                {catItems.map((item) => (
                  <div key={item.id} className="py-3 flex items-start gap-3">
                    <Badge
                      className={`text-xs font-semibold flex-shrink-0 mt-0.5 ${CONDITION_STYLES[item.condition]}`}
                    >
                      {CONDITION_LABELS[item.condition]}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 font-medium">{item.item}</p>
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Technician Notes */}
      {checklist.technicianNotes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Technician Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {checklist.technicianNotes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recommended Services */}
      {checklist.recommendedServices && checklist.recommendedServices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Recommended Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {checklist.recommendedServices.map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-400">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Completed by */}
      {checklist.completedBy && (
        <p className="text-xs text-gray-400 text-center pb-4">
          Inspected by {checklist.completedBy}
          {checklist.completedAt &&
            ` on ${new Date(checklist.completedAt).toLocaleString()}`}
        </p>
      )}
    </div>
  );
}
