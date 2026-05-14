"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, JOB_STATUS_COLORS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Calendar, MapPin, Navigation, Plus } from "lucide-react";
import { useState } from "react";

function getDaysInView(date: Date) {
  const days = [];
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function DispatchPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const days = getDaysInView(currentDate);

  const { data } = useQuery({
    queryKey: ["dispatch-jobs"],
    queryFn: () =>
      axios.get("/api/jobs?limit=100&status=SCHEDULED,APPROVED,IN_PROGRESS").then((r) => r.data),
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => axios.get("/api/users?role=TECHNICIAN").then((r) => r.data),
  });

  const jobs = data?.jobs || [];

  const getJobsForDay = (day: Date) => {
    return jobs.filter((j: { scheduledAt?: string }) => {
      if (!j.scheduledAt) return false;
      const d = new Date(j.scheduledAt);
      return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
      );
    });
  };

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Calendar</h1>
        <div className="flex items-center gap-2">
          <Link href="/jobs/new">
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Job
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}>← Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}>Next →</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const todayJobs = getJobsForDay(new Date()).filter((j: { serviceLocation?: string }) => j.serviceLocation);
              if (!todayJobs.length) { alert("No jobs with locations scheduled today."); return; }
              const stops = todayJobs.map((j: { serviceLocation: string }) => encodeURIComponent(j.serviceLocation)).join("/");
              window.open(`https://www.google.com/maps/dir/${stops}`, "_blank");
            }}
          >
            <Navigation className="h-4 w-4 mr-1" /> Optimize Route
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayJobs = getJobsForDay(day);
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={day.toISOString()} className={`min-h-32 rounded-lg border p-2 ${isToday ? "border-blue-400 bg-blue-50" : "bg-white"}`}>
              <div className={`text-xs font-semibold mb-2 ${isToday ? "text-blue-600" : "text-gray-500"}`}>
                <div>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className={`text-lg ${isToday ? "text-blue-600" : "text-gray-800"}`}>{day.getDate()}</div>
              </div>
              {dayJobs.map((job: {
                id: string;
                title: string;
                status: string;
                scheduledAt: string;
                customer: { firstName: string; lastName: string };
                technician?: { name: string };
              }) => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <div className={`text-xs p-1.5 rounded mb-1 truncate cursor-pointer hover:opacity-80 ${JOB_STATUS_COLORS[job.status]}`}>
                    <p className="font-medium truncate">{job.title}</p>
                    <p className="truncate text-[10px] opacity-75">
                      {new Date(job.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {job.technician ? ` · ${job.technician.name.split(" ")[0]}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      {/* Unscheduled Jobs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Unscheduled / Pending Jobs</CardTitle></CardHeader>
        <CardContent className="p-0">
          {jobs.filter((j: { scheduledAt?: string }) => !j.scheduledAt).length === 0 ? (
            <p className="text-sm text-gray-500 p-4">All jobs are scheduled.</p>
          ) : (
            <div className="divide-y">
              {jobs
                .filter((j: { scheduledAt?: string }) => !j.scheduledAt)
                .map((job: {
                  id: string;
                  jobNumber: string;
                  title: string;
                  status: string;
                  customer: { firstName: string; lastName: string; phone: string };
                  vehicle: { year: number; make: string; model: string };
                  serviceLocation?: string;
                  technician?: { name: string };
                }) => (
                  <div key={job.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-gray-500">
                        {job.customer.firstName} {job.customer.lastName} · {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </p>
                      {job.serviceLocation && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {job.serviceLocation}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                      <Link href={`/jobs/${job.id}`}>
                        <Button size="sm" variant="outline">Schedule</Button>
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
