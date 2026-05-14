"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type Warranty = {
  id: string;
  type: string;
  status: string;
  durationDays: number;
  startDate: string;
  expiryDate: string;
  claimedAt?: string;
  claimNotes?: string;
  partsWarranty?: string;
  laborWarranty?: string;
  notes?: string;
  job: { id: string; title: string; jobNumber: string };
  customer: { id: string; firstName: string; lastName: string; phone: string };
  vehicle: { id: string; year: number; make: string; model: string; plate?: string };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  CLAIMED: { label: "Claimed", color: "bg-orange-100 text-orange-800", icon: <AlertTriangle className="h-3 w-3" /> },
  EXPIRED: { label: "Expired", color: "bg-gray-100 text-gray-600", icon: <Clock className="h-3 w-3" /> },
  VOIDED: { label: "Voided", color: "bg-red-100 text-red-700", icon: <XCircle className="h-3 w-3" /> },
};

export default function WarrantyPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("active");
  const [claimDialog, setClaimDialog] = useState<Warranty | null>(null);
  const [claimNotes, setClaimNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["warranties", filter],
    queryFn: () => axios.get(`/api/warranties?filter=${filter}`).then((r) => r.data),
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) =>
      axios.patch(`/api/warranties/${id}`, { status: "CLAIMED", claimNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warranties"] });
      setClaimDialog(null);
      setClaimNotes("");
    },
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/warranties/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warranties"] }),
  });

  const warranties: Warranty[] = data?.warranties || [];
  const stats = data?.stats || {};

  const daysLeft = (expiryDate: string) => {
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
    return days;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Warranty Tracker</h1>
        <p className="text-sm text-gray-500">Manage parts and labor warranties for your jobs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active", value: stats.active || 0, color: "text-green-600", bg: "bg-green-50" },
          { label: "Expiring Soon", value: stats.expiringSoon || 0, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Claimed", value: stats.claimed || 0, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Expired", value: stats.expired || 0, color: "text-gray-600", bg: "bg-gray-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className={`p-4 ${s.bg} rounded-lg`}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { value: "active", label: "Active" },
          { value: "expiring_soon", label: "Expiring Soon" },
          { value: "claimed", label: "Claimed" },
          { value: "expired", label: "Expired" },
          { value: "all", label: "All" },
        ].map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Warranty List */}
      {isLoading ? (
        <div className="text-center text-gray-500 py-8">Loading warranties...</div>
      ) : warranties.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p>No warranties found for this filter.</p>
          <p className="text-xs text-gray-400 mt-1">Warranties are created automatically when jobs are completed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {warranties.map((w) => {
            const days = daysLeft(w.expiryDate);
            const status = STATUS_CONFIG[w.status] || STATUS_CONFIG.ACTIVE;
            return (
              <Card key={w.id} className={w.status === "ACTIVE" && days <= 30 ? "border-yellow-300" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="font-medium text-sm">{w.job.title}</span>
                        <span className="text-xs text-gray-400">{w.job.jobNumber}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {w.customer.firstName} {w.customer.lastName} · {w.vehicle.year} {w.vehicle.make} {w.vehicle.model}
                        {w.vehicle.plate && ` · ${w.vehicle.plate}`}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Type:</span>{" "}
                          <span className="font-medium">{w.type.replace(/_/g, " ")}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Start:</span>{" "}
                          <span>{formatDate(w.startDate)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Expires:</span>{" "}
                          <span className={days <= 30 && w.status === "ACTIVE" ? "text-yellow-600 font-medium" : ""}>{formatDate(w.expiryDate)}</span>
                        </div>
                        <div>
                          {w.status === "ACTIVE" && (
                            <span className={days <= 0 ? "text-red-600 font-medium" : days <= 30 ? "text-yellow-600 font-medium" : "text-green-600"}>
                              {days <= 0 ? "Expired" : `${days} days left`}
                            </span>
                          )}
                          {w.status === "CLAIMED" && w.claimedAt && (
                            <span className="text-orange-600">Claimed {formatDate(w.claimedAt)}</span>
                          )}
                        </div>
                      </div>
                      {w.partsWarranty && (
                        <p className="text-xs text-gray-500 mt-1">Parts: {w.partsWarranty}</p>
                      )}
                      {w.laborWarranty && (
                        <p className="text-xs text-gray-500">Labor: {w.laborWarranty}</p>
                      )}
                      {w.claimNotes && (
                        <p className="text-xs text-orange-700 mt-1 bg-orange-50 p-2 rounded">Claim: {w.claimNotes}</p>
                      )}
                    </div>
                    {w.status === "ACTIVE" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 text-xs"
                          onClick={() => setClaimDialog(w)}
                        >
                          File Claim
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 text-xs"
                          onClick={() => {
                            if (confirm("Void this warranty?")) voidMutation.mutate(w.id);
                          }}
                        >
                          Void
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Claim Dialog */}
      <Dialog open={!!claimDialog} onOpenChange={() => setClaimDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File Warranty Claim</DialogTitle>
          </DialogHeader>
          {claimDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium">{claimDialog.job.title}</p>
                <p className="text-gray-500">{claimDialog.customer.firstName} {claimDialog.customer.lastName}</p>
                <p className="text-gray-500">{claimDialog.vehicle.year} {claimDialog.vehicle.make} {claimDialog.vehicle.model}</p>
              </div>
              <div className="space-y-2">
                <Label>Claim Notes *</Label>
                <Textarea
                  rows={4}
                  placeholder="Describe the warranty claim issue..."
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setClaimDialog(null)}>Cancel</Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={!claimNotes || claimMutation.isPending}
                  onClick={() => claimMutation.mutate(claimDialog.id)}
                >
                  {claimMutation.isPending ? "Filing..." : "File Claim"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
