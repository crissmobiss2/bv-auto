"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ENTITIES = ["ALL", "Job", "Customer", "Vehicle", "Quote", "Invoice", "Payment", "JobPart", "User"];
const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN: "bg-gray-100 text-gray-700",
  LOGOUT: "bg-gray-100 text-gray-700",
  PAYMENT: "bg-purple-100 text-purple-700",
  STATUS_CHANGE: "bg-yellow-100 text-yellow-700",
  EMAIL_SENT: "bg-indigo-100 text-indigo-700",
  SMS_SENT: "bg-indigo-100 text-indigo-700",
  EXPORT: "bg-orange-100 text-orange-700",
};

export default function AuditLogPage() {
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", entityFilter, page],
    queryFn: () =>
      axios.get(`/api/audit?page=${page}&limit=50${entityFilter !== "ALL" ? `&entity=${entityFilter}` : ""}`)
        .then((r) => r.data),
  });

  const logs: {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    notes?: string;
    createdAt: string;
    user?: { name: string; email: string };
  }[] = data?.logs || [];

  const totalPages = Math.ceil((data?.total || 0) / 50);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-gray-600" /> Audit Log
          </h1>
          <p className="text-sm text-gray-500">{data?.total || 0} entries</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              {ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>{e === "ALL" ? "All Entities" : e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No audit entries found.</div>
          ) : (
            <>
              <div className="divide-y">
                {logs.map((log) => (
                  <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{log.entity}</span>
                        <span className="font-mono text-xs text-gray-400">{log.entityId.slice(0, 12)}…</span>
                      </div>
                      {log.notes && <p className="text-xs text-gray-500 mt-0.5">{log.notes}</p>}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{log.user?.name || "System"}</span>
                        <span>·</span>
                        <span>{formatDateTime(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
