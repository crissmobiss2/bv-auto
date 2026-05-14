"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, MapPin, Phone, Clock, ChevronRight } from "lucide-react";
import { JOB_STATUS_COLORS, formatDateTime } from "@/lib/utils";

const QUICK_STATUSES = ["SCHEDULED", "IN_PROGRESS", "PARTS_WAITING", "COMPLETED"];

export default function TechDashboardPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const { data, isLoading } = useQuery({
    queryKey: ["tech-jobs"],
    queryFn: () =>
      axios.get("/api/jobs?limit=50&status=SCHEDULED,APPROVED,IN_PROGRESS,PARTS_WAITING").then((r) => r.data),
    refetchInterval: 60000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) =>
      axios.patch(`/api/jobs/${jobId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tech-jobs"] }),
  });

  const myJobs = (data?.jobs || []).filter((j: { technicianId?: string }) =>
    j.technicianId === session?.user?.id
  );

  const todayJobs = myJobs.filter((j: { scheduledAt?: string }) => {
    if (!j.scheduledAt) return false;
    const d = new Date(j.scheduledAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const upcomingJobs = myJobs.filter((j: { scheduledAt?: string; status: string }) => {
    if (!j.scheduledAt) return false;
    const d = new Date(j.scheduledAt);
    const now = new Date();
    return d > now;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Jobs</h1>
        <p className="text-sm text-gray-500">{today}</p>
      </div>

      {/* Today's jobs */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Today ({todayJobs.length})
        </h2>
        {isLoading ? (
          <Card><CardContent className="p-4 text-center text-gray-500 text-sm">Loading...</CardContent></Card>
        ) : todayJobs.length === 0 ? (
          <Card><CardContent className="p-4 text-center text-gray-500 text-sm">No jobs scheduled for today.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {todayJobs.map((job: {
              id: string;
              jobNumber: string;
              title: string;
              status: string;
              scheduledAt?: string;
              serviceLocation?: string;
              customer: { firstName: string; lastName: string; phone: string };
              vehicle: { year: number; make: string; model: string };
            }) => (
              <Card key={job.id} className="border-l-4" style={{ borderLeftColor: job.status === "IN_PROGRESS" ? "#2563eb" : job.status === "COMPLETED" ? "#16a34a" : "#d97706" }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                      <p className="text-sm text-gray-500">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${JOB_STATUS_COLORS[job.status]}`}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <a href={`tel:${job.customer.phone}`} className="flex items-center gap-2 text-blue-600">
                      <Phone className="h-3.5 w-3.5" />
                      {job.customer.firstName} {job.customer.lastName} · {job.customer.phone}
                    </a>
                    {job.serviceLocation && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(job.serviceLocation)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-600"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {job.serviceLocation}
                      </a>
                    )}
                    {job.scheduledAt && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(job.scheduledAt)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={job.status}
                      onValueChange={(v) => statusMutation.mutate({ jobId: job.id, status: v })}
                    >
                      <SelectTrigger className="flex-1 h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUICK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Link href={`/tech/jobs/${job.id}`}>
                      <Button size="sm" variant="outline" className="h-9">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcomingJobs.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Upcoming ({upcomingJobs.length})
          </h2>
          <div className="space-y-2">
            {upcomingJobs.slice(0, 5).map((job: {
              id: string; title: string; status: string; scheduledAt?: string;
              vehicle: { year: number; make: string; model: string };
            }) => (
              <Link key={job.id} href={`/tech/jobs/${job.id}`}>
                <Card className="hover:bg-gray-50">
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-gray-500">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model} · {job.scheduledAt ? formatDateTime(job.scheduledAt) : "—"}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {myJobs.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Wrench className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No active jobs assigned to you.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
