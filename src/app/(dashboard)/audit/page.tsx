"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Shield, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ENTITIES = ["ALL", "Job", "Customer", "Vehicle", "Quote", "Invoice", "Payment", "JobPart", "User"];
const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN: "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300",
  LOGOUT: "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300",
  PAYMENT: "bg-purple-100 text-purple-700",
  STATUS_CHANGE: "bg-yellow-100 text-yellow-700",
  EMAIL_SENT: "bg-indigo-100 text-indigo-700",
  SMS_SENT: "bg-indigo-100 text-indigo-700",
  EXPORT: "bg-orange-100 text-orange-700",
};

export default function AuditLogPage() {
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Fetch users for the user filter dropdown
  const { data: usersData } = useQuery({
    queryKey: ["users-for-audit"],
    queryFn: () => axios.get("/api/users").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const users: { id: string; name: string; email: string }[] = usersData || [];

  function buildQueryString(extra: Record<string, string> = {}) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (entityFilter !== "ALL") params.set("entity", entityFilter);
    if (userFilter !== "ALL") params.set("userId", userFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params.toString();
  }

  const { data, isLoading } = useQuery({
    queryKey: ["audit", entityFilter, userFilter, startDate, endDate, page],
    queryFn: () =>
      axios.get(`/api/audit?${buildQueryString()}`).then((r) => r.data),
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

  function handleExportCsv() {
    const qs = buildQueryString({ export: "csv" });
    window.location.href = `/api/audit?${qs}`;
  }

  function resetFilters() {
    setEntityFilter("ALL");
    setUserFilter("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }

  const hasActiveFilters =
    entityFilter !== "ALL" || userFilter !== "ALL" || startDate || endDate;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="h-6 w-6 text-gray-600 dark:text-gray-400" /> Audit Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{data?.total || 0} entries</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Entity filter */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Entity</label>
              <Select
                value={entityFilter}
                onValueChange={(v) => { setEntityFilter(v); setPage(1); }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITIES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e === "ALL" ? "All Entities" : e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User filter */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">User</label>
              <Select
                value={userFilter}
                onValueChange={(v) => { setUserFilter(v); setPage(1); }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500 dark:text-gray-400">
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">No audit entries found.</div>
          ) : (
            <>
              <div className="divide-y">
                {logs.map((log) => (
                  <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs rounded px-1.5 py-0.5 font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300"}`}
                        >
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.entity}</span>
                        <span className="font-mono text-xs text-gray-400">{log.entityId.slice(0, 12)}…</span>
                      </div>
                      {log.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{log.notes}</p>}
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
