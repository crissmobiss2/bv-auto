"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar, Plus, Clock, CalendarCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { JOB_STATUS_COLORS } from "@/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7am–6pm

interface Job {
  id: string; jobNumber: string; title: string; status: string; scheduledAt?: string;
  estimatedHours?: number;
  customer: { firstName: string; lastName: string };
  vehicle: { year: number; make: string; model: string };
  technician?: { id: string; name: string };
}

interface Tech { id: string; name: string; }

function slotTop(dateStr: string) {
  const d = parseISO(dateStr);
  const hour = d.getHours() + d.getMinutes() / 60;
  return ((hour - 7) / 12) * 100;
}

function slotHeight(hours?: number) {
  return ((hours || 1) / 12) * 100;
}

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const from = weekStart.toISOString();
  const to = addDays(weekStart, 7).toISOString();

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["schedule-jobs", from],
    queryFn: () =>
      axios.get(`/api/jobs?from=${from}&to=${to}&limit=200`).then((r) => r.data.jobs || []),
  });

  const { data: techList = [] } = useQuery<Tech[]>({
    queryKey: ["technicians"],
    queryFn: () => axios.get("/api/users?role=TECHNICIAN").then(r => r.data),
  });

  // Scheduling dialog state
  const [scheduling, setScheduling] = useState<Job | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("08:00");
  const [schedTech, setSchedTech] = useState("");
  const [schedHours, setSchedHours] = useState("2");

  const scheduleMutation = useMutation({
    mutationFn: () => {
      const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString();
      return axios.patch(`/api/jobs/${scheduling!.id}`, {
        scheduledAt,
        technicianId: schedTech && schedTech !== "unassigned" ? schedTech : null,
        estimatedHours: parseFloat(schedHours) || 2,
        status: scheduling!.status === "PENDING_APPROVAL" || scheduling!.status === "APPROVED"
          ? "SCHEDULED"
          : scheduling!.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-jobs", from] });
      setScheduling(null);
    },
  });

  const openSchedule = (job: Job) => {
    setScheduling(job);
    // Default to today or existing date
    const existing = job.scheduledAt ? parseISO(job.scheduledAt) : new Date();
    setSchedDate(format(existing, "yyyy-MM-dd"));
    setSchedTime(format(existing, "HH:mm"));
    setSchedTech(job.technician?.id || "");
    setSchedHours(String(job.estimatedHours || 2));
  };

  const jobsForDay = (day: Date) =>
    jobs.filter((j) => j.scheduledAt && isSameDay(parseISO(j.scheduledAt), day));

  const unscheduled = jobs.filter((j) => !j.scheduledAt);
  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="h-6 w-6 text-blue-600" /> Schedule</h1>
          <p className="text-sm text-gray-500">Week of {format(weekStart, "MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Link href="/jobs/new">
            <Button><Plus className="h-4 w-4 mr-1" /> New Job</Button>
          </Link>
        </div>
      </div>

      {/* Week Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 text-xs text-gray-400 text-center">Time</div>
            {days.map((day) => (
              <div key={day.toISOString()} className={`p-2 text-center border-l ${isSameDay(day, today) ? "bg-blue-50" : ""}`}>
                <p className="text-xs text-gray-500">{format(day, "EEE")}</p>
                <p className={`text-lg font-semibold ${isSameDay(day, today) ? "text-blue-600" : "text-gray-900"}`}>
                  {format(day, "d")}
                </p>
                <p className="text-xs text-gray-400">{jobsForDay(day).length} jobs</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-8" style={{ height: "600px" }}>
            <div className="border-r">
              {HOURS.map((h) => (
                <div key={h} className="border-b flex items-start pt-1 px-2" style={{ height: `${100 / 12}%` }}>
                  <span className="text-xs text-gray-400">{h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}</span>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayJobs = jobsForDay(day);
              return (
                <div key={day.toISOString()} className={`border-l relative ${isSameDay(day, today) ? "bg-blue-50/30" : ""}`}>
                  {HOURS.map((h) => (
                    <div key={h} className="border-b" style={{ height: `${100 / 12}%` }} />
                  ))}
                  {dayJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`absolute left-0.5 right-0.5 rounded text-xs p-1 overflow-hidden cursor-pointer hover:opacity-90 border group ${
                        JOB_STATUS_COLORS[job.status] || "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                      style={{
                        top: `${slotTop(job.scheduledAt!)}%`,
                        height: `${Math.max(slotHeight(job.estimatedHours), 4)}%`,
                        minHeight: "32px",
                      }}
                      onClick={() => openSchedule(job)}
                    >
                      <p className="font-medium leading-tight truncate">{job.title}</p>
                      <p className="opacity-75 truncate">{job.customer.firstName} {job.customer.lastName}</p>
                      {job.technician && <p className="opacity-60 truncate">{job.technician.name}</p>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unscheduled jobs */}
      {unscheduled.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Unscheduled Jobs ({unscheduled.length})
            </h3>
            <div className="space-y-2">
              {unscheduled.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border">
                  <div>
                    <p className="text-sm font-medium">{job.jobNumber} — {job.title}</p>
                    <p className="text-xs text-gray-500">
                      {job.customer.firstName} {job.customer.lastName} · {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      {job.technician ? ` · ${job.technician.name}` : " · Unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={JOB_STATUS_COLORS[job.status]}>{job.status.replace("_", " ")}</Badge>
                    <Button size="sm" variant="outline" onClick={() => openSchedule(job)}>
                      <CalendarCheck className="h-3 w-3 mr-1" /> Schedule
                    </Button>
                    <Link href={`/jobs/${job.id}`}>
                      <Button size="sm" variant="ghost" className="text-xs">View</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Dialog */}
      <Dialog open={!!scheduling} onOpenChange={(o) => !o && setScheduling(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Job</DialogTitle>
          </DialogHeader>
          {scheduling && (
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium text-gray-700">{scheduling.jobNumber} — {scheduling.title}</p>
              <p className="text-xs text-gray-500">
                {scheduling.customer.firstName} {scheduling.customer.lastName} · {scheduling.vehicle.year} {scheduling.vehicle.make} {scheduling.vehicle.model}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Technician</Label>
                <Select value={schedTech} onValueChange={setSchedTech}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {techList.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estimated Hours</Label>
                <Input type="number" min="0.5" step="0.5" value={schedHours} onChange={e => setSchedHours(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduling(null)}>Cancel</Button>
            <Button onClick={() => scheduleMutation.mutate()} disabled={!schedDate || scheduleMutation.isPending}>
              {scheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
              Confirm Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
