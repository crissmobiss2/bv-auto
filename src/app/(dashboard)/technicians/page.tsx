"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wrench, Clock, DollarSign, TrendingUp, Star, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TechStat {
  id: string;
  name: string;
  email: string;
  jobsCompleted: number;
  jobsCompleted30d: number;
  avgJobValue: number;
  totalRevenue: number;
  revenue30d: number;
  hoursWorked30d: number;
  avgHoursPerJob: number;
  comebacks: number;
  utilization: number;
}

function StatBox({ label, value, sub, color = "blue" }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    orange: "text-orange-500 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
    purple: "text-purple-600 dark:text-purple-400",
  };
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  );
}

function UtilizationBar({ pct }: { pct: number }) {
  const capped = Math.min(100, Math.max(0, pct));
  const color = capped >= 70 ? "bg-green-500" : capped >= 40 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>Utilization</span>
        <span className="font-semibold">{Math.round(capped)}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${capped}%` }} />
      </div>
    </div>
  );
}

export default function TechniciansPage() {
  const { data, isLoading, isError } = useQuery<{ technicians: TechStat[] }>({
    queryKey: ["tech-scorecard"],
    queryFn: () => axios.get("/api/technicians/scorecard").then(r => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading scorecard…
    </div>
  );

  if (isError) return (
    <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
      <AlertTriangle className="h-4 w-4" /> Failed to load scorecard.
    </div>
  );

  const techs = data?.technicians ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Technician Scorecard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Performance metrics for all active technicians</p>
        </div>
        <Badge variant="outline" className="text-xs">{techs.length} techs</Badge>
      </div>

      {techs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No technicians found. Add technician accounts in Settings.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {techs.map((tech) => (
            <Card key={tech.id} className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 dark:text-blue-300 text-sm font-bold">
                        {tech.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-base dark:text-white">{tech.name}</CardTitle>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{tech.email}</p>
                    </div>
                  </div>
                  {tech.comebacks > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {tech.comebacks} comeback{tech.comebacks > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Key metrics grid */}
                <div className="grid grid-cols-3 gap-3 py-3 border-y dark:border-gray-800">
                  <StatBox
                    label="Jobs (30d)"
                    value={String(tech.jobsCompleted30d)}
                    sub={`${tech.jobsCompleted} all time`}
                    color="blue"
                  />
                  <StatBox
                    label="Revenue (30d)"
                    value={formatCurrency(tech.revenue30d)}
                    sub={formatCurrency(tech.totalRevenue) + " total"}
                    color="green"
                  />
                  <StatBox
                    label="Avg Job"
                    value={formatCurrency(tech.avgJobValue)}
                    sub="per RO"
                    color="purple"
                  />
                </div>

                {/* Hours row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {tech.hoursWorked30d.toFixed(1)}h
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">logged (30d)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {tech.avgHoursPerJob.toFixed(1)}h
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">avg/job</div>
                    </div>
                  </div>
                </div>

                <UtilizationBar pct={tech.utilization} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
