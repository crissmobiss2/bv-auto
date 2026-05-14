"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { MapPin, Navigation, Clock, Wrench } from "lucide-react";

interface TrackingResponse {
  location: {
    lat: number;
    lng: number;
    accuracy: number | null;
    createdAt: string;
  } | null;
  job: {
    title: string;
    status: string;
    scheduledAt: string | null;
    customer: { firstName: string; lastName: string } | null;
    technician: { name: string | null } | null;
  };
  eta: null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TrackJobPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const { data, isLoading, isError } = useQuery<TrackingResponse>({
    queryKey: ["track-job", jobId],
    queryFn: () => axios.get(`/api/tracking/job/${jobId}`).then((r) => r.data),
    refetchInterval: 30_000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading job info…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-gray-600 font-medium">Job not found</p>
          <p className="text-gray-400 text-sm">Please check your link or contact support.</p>
        </div>
      </div>
    );
  }

  const { location, job } = data;
  const isActive = job.status === "IN_PROGRESS" || job.status === "SCHEDULED";
  const headerText =
    job.status === "IN_PROGRESS"
      ? "Job in progress"
      : isActive
      ? "Your technician is on the way"
      : job.status === "COMPLETED"
      ? "Job completed"
      : "Tracking your service";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-5 safe-top">
        <div className="flex items-center gap-2 mb-1">
          <Navigation className="w-5 h-5" />
          <span className="font-semibold text-lg">{headerText}</span>
        </div>
        {job.technician?.name && (
          <p className="text-blue-200 text-sm">Technician: {job.technician.name}</p>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-4 p-4 max-w-lg mx-auto w-full">
        {/* Map placeholder */}
        <div className="bg-blue-50 rounded-2xl border border-blue-100 overflow-hidden shadow-sm">
          <div className="h-56 flex flex-col items-center justify-center gap-3 relative">
            <MapPin className="w-10 h-10 text-blue-400" />
            {location ? (
              <>
                <div className="text-center">
                  <p className="text-blue-700 font-mono text-sm font-semibold">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </p>
                  {location.accuracy != null && (
                    <p className="text-blue-400 text-xs mt-0.5">
                      ±{Math.round(location.accuracy)} m accuracy
                    </p>
                  )}
                </div>
                <p className="text-xs text-blue-400 italic px-6 text-center">
                  Live map available with Google Maps API key
                </p>
              </>
            ) : (
              <p className="text-blue-400 text-sm text-center px-6">
                Waiting for technician to share location…
              </p>
            )}
          </div>
        </div>

        {/* Last updated */}
        {location && (
          <div className="flex items-center gap-2 text-gray-500 text-sm px-1">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>Last updated at {formatTime(location.createdAt)}</span>
          </div>
        )}

        {/* Job details card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <div className="flex items-start gap-3 p-4">
            <Wrench className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Service</p>
              <p className="font-medium text-gray-800">{job.title}</p>
            </div>
          </div>

          {job.technician?.name && (
            <div className="flex items-start gap-3 p-4">
              <Navigation className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Technician</p>
                <p className="font-medium text-gray-800">{job.technician.name}</p>
              </div>
            </div>
          )}

          {job.scheduledAt && (
            <div className="flex items-start gap-3 p-4">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Scheduled</p>
                <p className="font-medium text-gray-800">
                  {new Date(job.scheduledAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* No location state */}
        {!location && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-yellow-700 text-sm text-center">
            Waiting for technician to share location…
          </div>
        )}

        <p className="text-center text-gray-300 text-xs pb-2">
          Auto-refreshes every 30 seconds
        </p>
      </div>
    </div>
  );
}
