"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Clock, Car, RefreshCw, Maximize2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency, JOB_STATUS_COLORS } from "@/lib/utils";
import { useState, useEffect } from "react";

const BOARD_COLUMNS = [
  { status: "SCHEDULED", label: "Scheduled", color: "bg-gray-100 border-gray-300" },
  { status: "IN_PROGRESS", label: "In Progress", color: "bg-blue-50 border-blue-300" },
  { status: "PARTS_WAITING", label: "Parts Waiting", color: "bg-yellow-50 border-yellow-300" },
  { status: "COMPLETED", label: "Ready / Done", color: "bg-green-50 border-green-300" },
];

interface Job {
  id: string; jobNumber: string; title: string; status: string;
  scheduledAt?: string; estimatedHours?: number;
  serviceLocation?: string;
  customer: { id: string; firstName: string; lastName: string; phone: string };
  vehicle: { id: string; year: number; make: string; model: string; plate?: string };
  technician?: { id: string; name: string };
  quote?: { totalAmount: number };
  invoice?: { totalAmount: number; amountDue: number };
  _count?: { parts: number; photos: number };
}

function JobCard({ job, technicians }: { job: Job; technicians: { id: string; name: string }[] }) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (status: string) => axios.patch(`/api/jobs/${job.id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shop-board"] }),
  });

  const techMutation = useMutation({
    mutationFn: (technicianId: string) => axios.patch(`/api/jobs/${job.id}`, { technicianId: technicianId === "unassigned" ? null : technicianId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shop-board"] }),
  });

  return (
    <div className="bg-white rounded-lg border shadow-sm p-3 space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-blue-700 hover:underline truncate block">
            {job.title}
          </Link>
          <p className="text-xs text-gray-400 font-mono">{job.jobNumber}</p>
        </div>
        <Badge className={`text-xs flex-shrink-0 ${JOB_STATUS_COLORS[job.status]}`}>
          {job.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-700">
          <Car className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="truncate">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</span>
          {job.vehicle.plate && <span className="text-gray-400">({job.vehicle.plate})</span>}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <Link href={`/customers/${job.customer.id}`} className="hover:underline truncate">
            {job.customer.firstName} {job.customer.lastName}
          </Link>
          <a href={`tel:${job.customer.phone}`} className="text-blue-600 hover:underline ml-auto flex-shrink-0">
            {job.customer.phone}
          </a>
        </div>
        {job.scheduledAt && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="h-3 w-3 text-gray-400" />
            {new Date(job.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {job.estimatedHours && <span className="text-gray-400">({job.estimatedHours}h est)</span>}
          </div>
        )}
      </div>

      {/* Assign tech */}
      <Select
        value={job.technician?.id || "unassigned"}
        onValueChange={(v) => techMutation.mutate(v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Assign tech..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {technicians.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quick status move */}
      <div className="flex gap-1 flex-wrap">
        {job.status === "SCHEDULED" && (
          <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700 flex-1"
            onClick={() => statusMutation.mutate("IN_PROGRESS")} disabled={statusMutation.isPending}>
            Start
          </Button>
        )}
        {job.status === "IN_PROGRESS" && (
          <>
            <Button size="sm" variant="outline" className="h-6 text-xs flex-1"
              onClick={() => statusMutation.mutate("PARTS_WAITING")} disabled={statusMutation.isPending}>
              Parts
            </Button>
            <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700 flex-1"
              onClick={() => statusMutation.mutate("COMPLETED")} disabled={statusMutation.isPending}>
              Done
            </Button>
          </>
        )}
        {job.status === "PARTS_WAITING" && (
          <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700 flex-1"
            onClick={() => statusMutation.mutate("IN_PROGRESS")} disabled={statusMutation.isPending}>
            Resume
          </Button>
        )}
        {job.status === "COMPLETED" && (
          <Button size="sm" variant="outline" className="h-6 text-xs flex-1"
            onClick={() => statusMutation.mutate("INVOICED")} disabled={statusMutation.isPending}>
            Invoice
          </Button>
        )}
      </div>

      {(job.quote || job.invoice) && (
        <div className="pt-1 border-t text-xs text-gray-500 flex justify-between">
          <span>{job.invoice ? "Invoice:" : "Quote:"}</span>
          <span className="font-medium text-gray-700">
            {formatCurrency(job.invoice ? Number(job.invoice.totalAmount) : Number(job.quote!.totalAmount))}
          </span>
        </div>
      )}
    </div>
  );
}

export default function ShopBoardPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shop-board"],
    queryFn: () =>
      axios.get("/api/jobs?limit=200&status=SCHEDULED,IN_PROGRESS,PARTS_WAITING,COMPLETED").then((r) => r.data),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Also fetch all active jobs (not just today's)
  const { data: activeData } = useQuery({
    queryKey: ["shop-board-active"],
    queryFn: () =>
      Promise.all([
        axios.get("/api/jobs?limit=100&status=SCHEDULED").then((r) => r.data.jobs || []),
        axios.get("/api/jobs?limit=100&status=IN_PROGRESS").then((r) => r.data.jobs || []),
        axios.get("/api/jobs?limit=100&status=PARTS_WAITING").then((r) => r.data.jobs || []),
        axios.get("/api/jobs?limit=50&status=COMPLETED").then((r) => r.data.jobs || []),
      ]).then(([scheduled, inProgress, partsWaiting, completed]) => ({
        SCHEDULED: scheduled,
        IN_PROGRESS: inProgress,
        PARTS_WAITING: partsWaiting,
        COMPLETED: completed,
      })),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: techData } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => axios.get("/api/users?role=TECHNICIAN").then((r) => r.data),
  });

  useEffect(() => {
    if (fullscreen && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!fullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [fullscreen]);

  const technicians = techData || [];
  const jobsByStatus = activeData || { SCHEDULED: [], IN_PROGRESS: [], PARTS_WAITING: [], COMPLETED: [] };

  const totalActive = (jobsByStatus.SCHEDULED?.length || 0) + (jobsByStatus.IN_PROGRESS?.length || 0) + (jobsByStatus.PARTS_WAITING?.length || 0);

  return (
    <div className={`space-y-4 ${fullscreen ? "fixed inset-0 z-50 bg-gray-100 p-4 overflow-auto" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shop Board</h1>
          <p className="text-sm text-gray-500">{totalActive} active jobs · {jobsByStatus.COMPLETED?.length || 0} ready for pickup</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "text-green-600 border-green-300" : ""}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin-slow" : ""}`} />
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFullscreen(!fullscreen)}>
            <Maximize2 className="h-4 w-4 mr-1" /> {fullscreen ? "Exit" : "Full Screen"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading shop board...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {BOARD_COLUMNS.map((col) => {
            const colJobs: Job[] = jobsByStatus[col.status as keyof typeof jobsByStatus] || [];
            return (
              <div key={col.status} className={`rounded-xl border-2 ${col.color} p-3`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm text-gray-800">{col.label}</h2>
                  <span className="text-xs font-semibold bg-white/70 rounded-full px-2 py-0.5 border">
                    {colJobs.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {colJobs.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center pt-4">No jobs</p>
                  ) : (
                    colJobs.map((job) => (
                      <JobCard key={job.id} job={job} technicians={technicians} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
