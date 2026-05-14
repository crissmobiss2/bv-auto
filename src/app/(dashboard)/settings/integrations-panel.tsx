"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, RefreshCw, Link2, Link2Off, Download } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function IntegrationsPanel() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");
  const errorParam = searchParams.get("error");
  const [syncPlatform, setSyncPlatform] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["accounting-integration"],
    queryFn: () => axios.get("/api/integrations/accounting").then(r => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: (platform: string) => axios.post("/api/integrations/accounting/sync", { platform }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-integration"] });
      setSyncPlatform(null);
    },
    onError: () => setSyncPlatform(null),
  });

  const disconnectMutation = useMutation({
    mutationFn: (platform: string) => axios.delete("/api/integrations/accounting", { data: { platform } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounting-integration"] }),
  });

  const qb = data?.quickbooks;
  const xero = data?.xero;
  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {successParam === "quickbooks" && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle className="h-4 w-4" /> QuickBooks connected successfully.
        </div>
      )}
      {errorParam && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4" /> Connection failed: {errorParam.replace(/_/g, " ")}. Check your QB credentials.
        </div>
      )}

      {/* QuickBooks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="text-green-700 font-bold text-base">QB</span> QuickBooks Online
            </span>
            {qb?.connected ? (
              <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">Not connected</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {qb?.connected ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-gray-400">Company</p>
                  <p className="font-medium">{qb.companyName || "—"}</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-gray-400">Last Sync</p>
                  <p className="font-medium">{qb.lastSync ? new Date(qb.lastSync).toLocaleString() : "Never"}</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-gray-400">Synced Invoices</p>
                  <p className="font-medium">{stats?.syncedCount || 0}</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-gray-400">Pending Sync</p>
                  <p className="font-medium text-orange-600">{stats?.pendingCount || 0}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setSyncPlatform("quickbooks"); syncMutation.mutate("quickbooks"); }} disabled={syncMutation.isPending && syncPlatform === "quickbooks"}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncMutation.isPending && syncPlatform === "quickbooks" ? "animate-spin" : ""}`} />
                  {syncMutation.isPending && syncPlatform === "quickbooks" ? "Syncing..." : "Sync Now"}
                </Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50" onClick={() => disconnectMutation.mutate("quickbooks")} disabled={disconnectMutation.isPending}>
                  <Link2Off className="h-3 w-3 mr-1" /> Disconnect
                </Button>
              </div>
              {syncMutation.isSuccess && syncPlatform === null && (
                <p className="text-xs text-green-600">
                  Sync complete: {(syncMutation.data as { data: { synced: number; failed: number } })?.data?.synced} synced, {(syncMutation.data as { data: { synced: number; failed: number } })?.data?.failed} failed.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-500 text-xs">Connect QuickBooks to automatically sync paid invoices. Requires a QuickBooks Online account and API credentials set in your environment.</p>
              <div className="text-xs text-gray-400 bg-gray-50 rounded p-2 font-mono space-y-1">
                <p>QUICKBOOKS_CLIENT_ID=...</p>
                <p>QUICKBOOKS_CLIENT_SECRET=...</p>
              </div>
              <a href="/api/integrations/quickbooks/connect">
                <Button size="sm" className="bg-green-700 hover:bg-green-800">
                  <Link2 className="h-3 w-3 mr-1" /> Connect QuickBooks
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Xero */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="text-blue-600 font-bold text-base">X</span> Xero
            </span>
            {xero?.connected ? (
              <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">Coming Soon</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500">
          <p className="text-xs">Xero integration is in development. Use the QuickBooks connection or CSV export in the meantime.</p>
        </CardContent>
      </Card>

      {/* CSV Export */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">CSV Export (QuickBooks / Xero Compatible)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">Download invoice data as a CSV file compatible with QuickBooks Desktop, Xero, and most accounting platforms.</p>
          <a href="/api/invoices/export" download>
            <Button size="sm" variant="outline">
              <Download className="h-3 w-3 mr-1" /> Download CSV
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
