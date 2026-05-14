"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Phone, MapPin, ClipboardCheck, Camera, FileText, Clock, CheckCircle, Shield, Navigation } from "lucide-react";
import { JOB_STATUS_COLORS, formatDateTime } from "@/lib/utils";
import { InspectionChecklist } from "@/components/features/inspection-checklist";
import { PhotoUpload } from "@/components/features/photo-upload";
import { useState, useEffect } from "react";

const TECH_STATUSES = ["SCHEDULED", "IN_PROGRESS", "PARTS_WAITING", "COMPLETED"];

export default function TechJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "ready" | "denied">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [healthScore, setHealthScore] = useState<{ score: number; summary: string } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      setGpsStatus("locating");
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus("ready"); },
        () => setGpsStatus("denied"),
        { timeout: 8000 }
      );
    }
  }, []);

  const { data: timelogs, refetch: refetchTime } = useQuery({
    queryKey: ["timelogs", id],
    queryFn: () => axios.get(`/api/jobs/${id}/timelog`).then(r => r.data),
  });

  const clockInMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${id}/timelog`, { action: "clock-in", lat: gpsCoords?.lat, lng: gpsCoords?.lng }),
    onSuccess: () => refetchTime(),
  });

  const clockOutMutation = useMutation({
    mutationFn: (logId: string) => axios.post(`/api/jobs/${id}/timelog`, { action: "clock-out", logId }),
    onSuccess: () => refetchTime(),
  });

  const healthScoreMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${id}/health-score`),
    onSuccess: (res) => setHealthScore(res.data),
  });

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => axios.get(`/api/jobs/${id}`).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => axios.patch(`/api/jobs/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", id] }),
  });

  const noteMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${id}/notes`, { content: note, isInternal: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      setNote("");
    },
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!job) return <div className="p-8 text-center text-red-500">Job not found.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/tech">
          <Button variant="ghost" size="icon" className="flex-shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate">{job.title}</h1>
          <p className="text-sm text-gray-500">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</p>
        </div>
      </div>

      {/* Status */}
      <Select value={job.status} onValueChange={(v) => statusMutation.mutate(v)}>
        <SelectTrigger className={`w-full font-medium ${JOB_STATUS_COLORS[job.status]}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TECH_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Info */}
      <Card>
        <CardContent className="p-4 space-y-3 text-sm">
          <a href={`tel:${job.customer.phone}`} className="flex items-center gap-2 text-blue-600 font-medium">
            <Phone className="h-4 w-4" />
            {job.customer.firstName} {job.customer.lastName} · {job.customer.phone}
          </a>
          {job.serviceLocation && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(job.serviceLocation)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-gray-600"
            >
              <MapPin className="h-4 w-4 mt-0.5" />
              {job.serviceLocation}
            </a>
          )}
          {job.scheduledAt && (
            <p className="text-gray-500">🕐 {formatDateTime(job.scheduledAt)}</p>
          )}
          {job.mileageIn && (
            <p className="text-gray-500">Mileage In: {job.mileageIn.toLocaleString()}</p>
          )}
          {job.description && (
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Description</p>
              <p className="text-gray-700">{job.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Clock */}
      {(() => {
        const logs = timelogs?.logs || [];
        const openLog = logs.find((l: { clockedOut: string | null }) => !l.clockedOut);
        const totalMin = timelogs?.totalMinutes || 0;
        return (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" /> Time Clock</p>
                {gpsStatus === "ready" && gpsCoords && (
                  <span className="text-xs text-green-600 flex items-center gap-1"><Navigation className="h-3 w-3" /> GPS Ready</span>
                )}
                {gpsStatus === "denied" && <span className="text-xs text-gray-400">GPS unavailable</span>}
              </div>
              <div className="flex items-center gap-3">
                {openLog ? (
                  <Button size="sm" variant="outline" className="border-red-400 text-red-600 hover:bg-red-50"
                    onClick={() => clockOutMutation.mutate(openLog.id)} disabled={clockOutMutation.isPending}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Clock Out
                  </Button>
                ) : (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}>
                    <Clock className="h-3 w-3 mr-1" /> Clock In
                  </Button>
                )}
                <span className="text-sm text-gray-600">
                  {totalMin > 0 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m logged` : "No time logged yet"}
                </span>
                {openLog && <span className="text-xs text-green-600 font-medium animate-pulse">● Active</span>}
              </div>
              {gpsCoords && openLog && (
                <p className="text-xs text-gray-400 mt-1">
                  Location captured: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Vehicle Health Score */}
      {job.checklist && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`h-5 w-5 ${healthScore ? (healthScore.score >= 70 ? "text-green-600" : healthScore.score >= 50 ? "text-yellow-600" : "text-red-600") : "text-gray-400"}`} />
              <div>
                <p className="text-sm font-medium">Vehicle Health Score</p>
                {healthScore ? (
                  <p className={`text-xs ${healthScore.score >= 70 ? "text-green-600" : "text-orange-600"}`}>{healthScore.score}/100 — {healthScore.summary}</p>
                ) : (
                  <p className="text-xs text-gray-400">Compute from inspection checklist</p>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => healthScoreMutation.mutate()} disabled={healthScoreMutation.isPending}>
              {healthScoreMutation.isPending ? "..." : healthScore ? "Refresh" : "Compute"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="notes">
        <TabsList className="w-full">
          <TabsTrigger value="notes" className="flex-1">
            <FileText className="h-4 w-4 mr-1" /> Notes
          </TabsTrigger>
          <TabsTrigger value="inspection" className="flex-1">
            <ClipboardCheck className="h-4 w-4 mr-1" /> Inspection
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex-1">
            <Camera className="h-4 w-4 mr-1" /> Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-3 space-y-3">
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <Button
              className="w-full"
              onClick={() => noteMutation.mutate()}
              disabled={!note || noteMutation.isPending}
            >
              {noteMutation.isPending ? "Saving..." : "Add Note"}
            </Button>
          </div>
          {job.jobNotes?.map((n: { id: string; content: string; createdAt: string; author: { name: string } }) => (
            <div key={n.id} className="bg-gray-50 rounded-md p-3 text-sm">
              <p>{n.content}</p>
              <p className="text-xs text-gray-400 mt-1">{n.author.name} · {new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="inspection" className="mt-3">
          <InspectionChecklist job={job} />
        </TabsContent>

        <TabsContent value="photos" className="mt-3">
          <PhotoUpload jobId={job.id} photos={job.photos || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
