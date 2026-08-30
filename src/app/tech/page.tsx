"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Wrench, MapPin, Phone, Clock, ChevronRight,
  CheckCircle2, PlayCircle, PauseCircle, AlertCircle, Loader2, Zap,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type Job = {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  scheduledAt?: string;
  serviceLocation?: string;
  customer: { firstName: string; lastName: string; phone: string };
  vehicle: { year: number; make: string; model: string };
  technicianId?: string;
};

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  darkBg: string;
  icon: React.ElementType;
  borderColor: string;
  accentClass: string;
}> = {
  SCHEDULED: {
    label: "Scheduled",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50",
    darkBg: "dark:bg-amber-500/10",
    icon: Clock,
    borderColor: "#d97706",
    accentClass: "border-l-amber-500",
  },
  APPROVED: {
    label: "Approved",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50",
    darkBg: "dark:bg-blue-500/10",
    icon: CheckCircle2,
    borderColor: "#2563eb",
    accentClass: "border-l-blue-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-800 dark:text-blue-300",
    bg: "bg-blue-100",
    darkBg: "dark:bg-blue-500/15",
    icon: Zap,
    borderColor: "#1d4ed8",
    accentClass: "border-l-blue-700",
  },
  PARTS_WAITING: {
    label: "Parts Wait",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50",
    darkBg: "dark:bg-orange-500/10",
    icon: PauseCircle,
    borderColor: "#ea580c",
    accentClass: "border-l-orange-500",
  },
  COMPLETED: {
    label: "Completed",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50",
    darkBg: "dark:bg-emerald-500/10",
    icon: CheckCircle2,
    borderColor: "#059669",
    accentClass: "border-l-emerald-500",
  },
};

const QUICK_STATUSES = ["SCHEDULED", "IN_PROGRESS", "PARTS_WAITING", "COMPLETED"] as const;

function QuickStatusBar({ jobId, currentStatus, mutate, isPending }: {
  jobId: string;
  currentStatus: string;
  mutate: (args: { jobId: string; status: string }) => void;
  isPending: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 mt-4">
      {QUICK_STATUSES.map((s) => {
        const cfg = STATUS_CONFIG[s];
        const active = currentStatus === s;
        return (
          <button
            key={s}
            disabled={active || isPending}
            onClick={() => mutate({ jobId, status: s })}
            className={`
              py-3 px-1 rounded-xl text-[11px] font-bold transition-all active:scale-95 flex flex-col items-center gap-1.5
              ${active
                ? `${cfg.bg} ${cfg.darkBg} ${cfg.color} ring-2 ring-current ring-offset-1 shadow-sm`
                : "bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-white/35 hover:bg-gray-200 dark:hover:bg-white/[0.1]"
              }
            `}
          >
            <cfg.icon className="h-4 w-4" />
            <span className="leading-none">{cfg.label.split(" ")[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TechDashboardPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const { data, isLoading } = useQuery({
    queryKey: ["tech-jobs"],
    queryFn: () =>
      axios.get("/api/jobs?limit=50&status=SCHEDULED,APPROVED,IN_PROGRESS,PARTS_WAITING,COMPLETED").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) =>
      axios.patch(`/api/jobs/${jobId}`, { status }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tech-jobs"] });
      const label = STATUS_CONFIG[vars.status]?.label || vars.status;
      toast.success("Status updated", `Job marked as ${label}`);
    },
    onError: () => toast.error("Update failed", "Could not update job status."),
  });

  const myJobs: Job[] = (data?.jobs || []).filter((j: Job) =>
    j.technicianId === session?.user?.id
  );

  const now = new Date();
  const todayStr = now.toDateString();

  const todayJobs = myJobs.filter(j => {
    if (!j.scheduledAt) return ["IN_PROGRESS", "PARTS_WAITING"].includes(j.status);
    return new Date(j.scheduledAt).toDateString() === todayStr;
  });

  const upcomingJobs = myJobs.filter(j => {
    if (!j.scheduledAt) return false;
    const d = new Date(j.scheduledAt);
    return d > now && d.toDateString() !== todayStr;
  });

  const activeCount = myJobs.filter(j => j.status === "IN_PROGRESS").length;
  const doneCount   = myJobs.filter(j => j.status === "COMPLETED").length;
  const firstName   = session?.user?.name?.split(" ")[0] || "Tech";

  return (
    <div className="space-y-5 pb-safe-area-bottom pb-8">

      {/* ── Premium hero header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-xl shadow-blue-900/20"
        style={{ background: "linear-gradient(135deg, #1a56db 0%, #1e40af 50%, #1e3a8a 100%)" }}>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/[0.06]" />
        <div className="absolute -bottom-8 -right-2 w-24 h-24 rounded-full bg-white/[0.04]" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-200">Good {getGreeting()}</p>
              <p className="text-xl font-bold leading-tight tracking-tight">{firstName}</p>
            </div>
          </div>
          <p className="text-blue-300/80 text-sm mt-2.5 font-medium">{today}</p>

          <div className="flex gap-5 mt-4 pt-4 border-t border-white/15">
            <div>
              <div className="text-3xl font-bold tracking-tight font-nums">{todayJobs.length}</div>
              <div className="text-blue-300/70 text-xs font-medium mt-0.5">Today</div>
            </div>
            <div className="w-px bg-white/15" />
            <div>
              <div className={`text-3xl font-bold tracking-tight font-nums ${activeCount > 0 ? "text-yellow-300" : ""}`}>
                {activeCount}
              </div>
              <div className="text-blue-300/70 text-xs font-medium mt-0.5">Active</div>
            </div>
            <div className="w-px bg-white/15" />
            <div>
              <div className={`text-3xl font-bold tracking-tight font-nums ${doneCount > 0 ? "text-emerald-300" : ""}`}>
                {doneCount}
              </div>
              <div className="text-blue-300/70 text-xs font-medium mt-0.5">Done</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Today's jobs ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[11px] font-bold text-gray-500 dark:text-white/30 uppercase tracking-widest mb-3 px-0.5">
          Today · {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""}
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-14 text-gray-400 dark:text-white/30">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : todayJobs.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white/80">All clear for today</p>
            <p className="text-xs text-gray-400 dark:text-white/30 mt-1">No jobs scheduled right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayJobs.map((job) => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.SCHEDULED;
              const Icon = cfg.icon;
              return (
                <div
                  key={job.id}
                  className={`bg-white dark:bg-[#111827] rounded-2xl border border-gray-200 dark:border-white/[0.07] overflow-hidden shadow-sm border-l-4 ${cfg.accentClass} transition-all`}
                >
                  {/* Status banner */}
                  <div className={`flex items-center gap-2 px-4 py-2.5 ${cfg.bg} ${cfg.darkBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    <span className={`text-[10px] font-bold ${cfg.color} uppercase tracking-widest`}>
                      {cfg.label}
                    </span>
                    <span className="ml-auto text-[11px] text-gray-400 dark:text-white/25 font-mono font-semibold">
                      #{job.jobNumber}
                    </span>
                  </div>

                  <div className="px-4 pt-4 pb-4">
                    {/* Vehicle + title */}
                    <p className="font-bold text-gray-900 dark:text-white text-base leading-tight tracking-tight">
                      {job.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5 font-medium">
                      {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                    </p>

                    {/* Contact / location */}
                    <div className="mt-4 space-y-2.5">
                      <a
                        href={`tel:${job.customer.phone}`}
                        className="flex items-center gap-3 active:opacity-70"
                      >
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white/90 leading-tight">
                            {job.customer.firstName} {job.customer.lastName}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{job.customer.phone}</p>
                        </div>
                      </a>

                      {job.serviceLocation && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(job.serviceLocation)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 active:opacity-70"
                        >
                          <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-100 dark:border-white/[0.07] flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-3.5 w-3.5 text-gray-500 dark:text-white/40" />
                          </div>
                          <p className="text-sm text-gray-700 dark:text-white/70 font-medium">{job.serviceLocation}</p>
                        </a>
                      )}

                      {job.scheduledAt && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-100 dark:border-white/[0.07] flex items-center justify-center flex-shrink-0">
                            <Clock className="h-3.5 w-3.5 text-gray-500 dark:text-white/40" />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-white/60 font-medium">{formatDateTime(job.scheduledAt)}</p>
                        </div>
                      )}
                    </div>

                    {/* Quick status buttons */}
                    <QuickStatusBar
                      jobId={job.id}
                      currentStatus={job.status}
                      mutate={statusMutation.mutate}
                      isPending={statusMutation.isPending}
                    />

                    {/* Open details */}
                    <Link href={`/tech/jobs/${job.id}`} className="block mt-3.5">
                      <button className="w-full h-12 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm font-bold text-gray-700 dark:text-white/70 flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/[0.07] active:scale-[0.98] transition-all">
                        Open Job Details
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upcoming jobs ─────────────────────────────────────────────────── */}
      {upcomingJobs.length > 0 && (
        <div>
          <h2 className="text-[11px] font-bold text-gray-500 dark:text-white/30 uppercase tracking-widest mb-3 px-0.5">
            Upcoming · {upcomingJobs.length}
          </h2>
          <div className="space-y-2">
            {upcomingJobs.slice(0, 5).map((job) => (
              <Link key={job.id} href={`/tech/jobs/${job.id}`}>
                <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50/70 dark:hover:bg-white/[0.03] active:scale-[0.99] transition-all shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-100 dark:border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-4 w-4 text-gray-400 dark:text-white/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white/90 truncate">{job.title}</p>
                    <p className="text-xs text-gray-500 dark:text-white/40 font-medium">
                      {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      {job.scheduledAt && (
                        <span className="text-blue-500 dark:text-blue-400 ml-2">· {formatDateTime(job.scheduledAt)}</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {myJobs.length === 0 && !isLoading && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.07] flex items-center justify-center mx-auto mb-4">
            <Wrench className="h-7 w-7 text-gray-300 dark:text-white/20" />
          </div>
          <p className="text-gray-600 dark:text-white/50 font-bold text-base">No jobs assigned yet</p>
          <p className="text-xs text-gray-400 dark:text-white/25 mt-1.5">Your dispatcher will assign jobs here.</p>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
