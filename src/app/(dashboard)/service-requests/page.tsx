"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Car, Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDate, formatPhone } from "@/lib/utils";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  DECLINED: "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400",
};

export default function ServiceRequestsPage() {
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["service-requests"],
    queryFn: () => axios.get("/api/booking").then((r) => r.data),
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      axios.patch(`/api/service-requests/${id}`, { status, notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-requests"] }),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>;

  const pending = (requests || []).filter((r: { status: string }) => r.status === "PENDING");
  const others = (requests || []).filter((r: { status: string }) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Service Requests</h1>
        {pending.length > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800 text-sm">{pending.length} pending</Badge>
        )}
      </div>

      {pending.length === 0 && others.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">No service requests yet.</CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">New Requests</h2>
          {pending.map((r: {
            id: string; name: string; phone: string; email?: string;
            vehicleYear?: number; vehicleMake?: string; vehicleModel?: string;
            serviceType: string; description: string; preferredDate?: string;
            createdAt: string; customer?: { id: string; firstName: string; lastName: string };
          }) => (
            <Card key={r.id} className="border-yellow-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-blue-600">
                        <Phone className="h-3 w-3" /> {formatPhone(r.phone)}
                      </a>
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-blue-600">
                          <Mail className="h-3 w-3" /> {r.email}
                        </a>
                      )}
                    </div>

                    {(r.vehicleMake || r.vehicleYear) && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Car className="h-3 w-3" />
                        {r.vehicleYear} {r.vehicleMake} {r.vehicleModel}
                      </div>
                    )}

                    <div className="bg-gray-50 dark:bg-white/5 rounded-md p-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{r.serviceType}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{r.description}</p>
                    </div>

                    {r.preferredDate && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3" /> Preferred: {r.preferredDate}
                      </div>
                    )}

                    {r.customer && (
                      <p className="text-xs text-blue-600">
                        Matched to existing customer:{" "}
                        <Link href={`/customers/${r.customer.id}`} className="underline">
                          {r.customer.firstName} {r.customer.lastName}
                        </Link>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/jobs/new?name=${encodeURIComponent(r.name)}&phone=${encodeURIComponent(r.phone)}&service=${encodeURIComponent(r.serviceType)}`}>
                      <Button size="sm" className="w-full" onClick={() => updateMutation.mutate({ id: r.id, status: "SCHEDULED" })}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Schedule
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMutation.mutate({ id: r.id, status: "DECLINED" })}
                      disabled={updateMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Previous Requests</h2>
          {others.map((r: { id: string; name: string; phone: string; serviceType: string; status: string; createdAt: string }) => (
            <div key={r.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border text-sm">
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="text-gray-400 mx-2">·</span>
                <span className="text-gray-600 dark:text-gray-400">{r.serviceType}</span>
                <span className="text-gray-400 ml-2 text-xs">{formatDate(r.createdAt)}</span>
              </div>
              <span className={`text-xs rounded-md px-2 py-0.5 font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
