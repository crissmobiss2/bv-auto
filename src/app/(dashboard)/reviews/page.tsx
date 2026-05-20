"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Send, CheckCircle, Clock, MousePointerClick, TrendingUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [sentId, setSentId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews-dashboard"],
    queryFn: () => axios.get("/api/reviews/dashboard").then(r => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: (jobId: string) => axios.post(`/api/reviews/${jobId}/send`),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["reviews-dashboard"] });
      setSuccessId(jobId);
      setSentId(null);
      setTimeout(() => setSuccessId(null), 3000);
    },
    onSettled: () => setSentId(null),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading reviews...</div>;

  const d = data || {};

  const stats = [
    { label: "Total Requests", value: d.total || 0, icon: Star, color: "text-yellow-600 bg-yellow-50" },
    { label: "Sent", value: d.sent || 0, icon: Send, color: "text-blue-600 bg-blue-50" },
    { label: "Clicked (Engaged)", value: d.clicked || 0, icon: MousePointerClick, color: "text-green-600 bg-green-50" },
    { label: "Click Rate", value: `${d.clickRate || 0}%`, icon: TrendingUp, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Star className="h-6 w-6 text-yellow-500" /> Review Requests</h1>
        <p className="text-sm text-gray-500">Track and send review requests — every 5-star review is worth thousands in future business</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Review Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {(!d.recent || d.recent.length === 0) ? (
            <div className="text-center py-8 text-gray-400">
              <Star className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No review requests yet. They send automatically 24h after job completion.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {d.recent.map((r: {
                id: string; jobId: string; sentAt?: string; clickedAt?: string;
                customer: { firstName: string; lastName: string; phone: string };
                job: { jobNumber: string; title: string; vehicle: { year: number; make: string; model: string } };
              }) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.customer.firstName} {r.customer.lastName}</p>
                    <p className="text-xs text-gray-500">{r.job.vehicle.year} {r.job.vehicle.make} {r.job.vehicle.model} · {r.job.title}</p>
                    <Link href={`/jobs/${r.jobId}`} className="text-xs text-blue-600 hover:underline">{r.job.jobNumber}</Link>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      {r.clickedAt ? (
                        <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Clicked</Badge>
                      ) : r.sentAt ? (
                        <Badge className="bg-blue-100 text-blue-700 text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Sent {formatDate(r.sentAt)}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Not sent</Badge>
                      )}
                    </div>
                    {successId === r.jobId ? (
                      <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Sent!</Badge>
                    ) : (
                      <Button size="sm" variant="outline"
                        disabled={sentId === r.jobId}
                        onClick={() => { setSentId(r.jobId); sendMutation.mutate(r.jobId); }}>
                        <Send className="h-3 w-3 mr-1" />
                        {sentId === r.jobId ? "Sending..." : r.sentAt ? "Resend" : "Send Now"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <h3 className="font-semibold text-yellow-900 flex items-center gap-2 mb-2"><Star className="h-4 w-4 text-yellow-600" /> How Review Automation Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-yellow-800">
            <div className="flex items-start gap-2"><span className="font-bold text-yellow-600">1.</span> Job status changes to COMPLETED or invoice is marked PAID</div>
            <div className="flex items-start gap-2"><span className="font-bold text-yellow-600">2.</span> 24 hours later, daily cron auto-sends a personalized text with your Google Review link</div>
            <div className="flex items-start gap-2"><span className="font-bold text-yellow-600">3.</span> You see who clicked — use "Send Now" to manually trigger for any job</div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-yellow-700">
            <ExternalLink className="h-3 w-3" />
            Set your Google Review URL in <Link href="/shops" className="underline font-medium">Shops &amp; Locations</Link> → Google Review URL field
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
