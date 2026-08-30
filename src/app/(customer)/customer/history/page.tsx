"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatDateTime } from "@/lib/utils";
import { Clock, Car, User, CheckCircle, Loader } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-purple-100 text-purple-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  COMPLETED: CheckCircle,
  IN_PROGRESS: Loader,
  SCHEDULED: Clock,
};

export default function CustomerHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-dashboard"],
    queryFn: () => axios.get("/api/customer/dashboard").then(r => r.data),
  });

  const jobs = data?.recentJobs || [];

  if (isLoading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Service History</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{jobs.length} service record{jobs.length !== 1 ? "s" : ""}</p>
      </div>

      {jobs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-gray-400">No service records yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: {
            id: string; jobNumber: string; title: string; status: string;
            scheduledAt?: string; completedAt?: string; createdAt: string;
            vehicle?: { year: number; make: string; model: string };
            technician?: { name: string };
          }) => {
            const StatusIcon = STATUS_ICONS[job.status] || Clock;
            return (
              <Card key={job.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 rounded-lg mt-0.5 ${STATUS_COLORS[job.status] || "bg-gray-100 dark:bg-white/10"}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{job.title}</p>
                        <p className="text-xs text-gray-400">{job.jobNumber}</p>
                        {job.vehicle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                            <Car className="h-3 w-3" />
                            {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                          </p>
                        )}
                        {job.technician && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {job.technician.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <Badge className={`text-xs ${STATUS_COLORS[job.status] || "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400"}`}>
                        {job.status.replace(/_/g, " ")}
                      </Badge>
                      <p className="text-xs text-gray-400 block">
                        {formatDateTime(job.completedAt || job.scheduledAt || job.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
