"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, DollarSign, Clock, Target, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function PipelinePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => axios.get("/api/pipeline").then((r) => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading pipeline...</div>;

  const summary = data?.summary || {};
  const forecast = data?.forecast || {};
  const quotes = data?.quotes || [];
  const scheduledJobs = data?.scheduledJobs || [];
  const fleetAccounts = data?.fleetAccounts || [];
  const monthlyTrend = data?.monthlyTrend || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue Pipeline</h1>
        <p className="text-sm text-gray-500">Forecasted revenue and sales funnel overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Pipeline</p>
              <p className="text-xl font-bold">{formatCurrency(summary.totalPipeline || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Weighted Value</p>
              <p className="text-xl font-bold">{formatCurrency(summary.weightedPipeline || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><Clock className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Scheduled Jobs</p>
              <p className="text-xl font-bold">{formatCurrency(summary.scheduledRevenue || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><Building2 className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Fleet MRR</p>
              <p className="text-xl font-bold">{formatCurrency(summary.fleetMonthlyValue || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 30/60/90 Day Forecast */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Revenue Forecast</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "30 Days", value: forecast.days30 || 0, color: "bg-green-500" },
                { label: "60 Days", value: forecast.days60 || 0, color: "bg-blue-500" },
                { label: "90 Days", value: forecast.days90 || 0, color: "bg-purple-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{ width: `${Math.min(100, (item.value / Math.max(forecast.days90 || 1, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">6-Month Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Open Quotes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Open Quotes (Pipeline)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">No open quotes in pipeline.</p>
          ) : (
            <div className="divide-y">
              {quotes.map((q: {
                id: string;
                quoteNumber: string;
                title: string;
                totalAmount: number;
                probability: number;
                weightedValue: number;
                customer: { firstName: string; lastName: string };
                vehicle: { year: number; make: string; model: string };
                createdAt: string;
              }) => (
                <div key={q.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{q.title}</p>
                    <p className="text-xs text-gray-500">
                      {q.customer.firstName} {q.customer.lastName} · {q.vehicle.year} {q.vehicle.make} {q.vehicle.model}
                    </p>
                    <p className="text-xs text-gray-400">{q.quoteNumber} · {new Date(q.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(q.totalAmount)}</p>
                    <p className="text-xs text-gray-500">{q.probability}% close probability</p>
                    <p className="text-xs text-green-600 font-medium">Weighted: {formatCurrency(q.weightedValue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduled Jobs */}
        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming Scheduled Jobs</CardTitle></CardHeader>
          <CardContent className="p-0">
            {scheduledJobs.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No upcoming jobs.</p>
            ) : (
              <div className="divide-y max-h-64 overflow-y-auto">
                {scheduledJobs.map((j: {
                  id: string;
                  title: string;
                  estimatedTotal: number;
                  scheduledAt: string;
                  customer: { firstName: string; lastName: string };
                }) => (
                  <div key={j.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{j.title}</p>
                      <p className="text-xs text-gray-500">{j.customer.firstName} {j.customer.lastName}</p>
                      <p className="text-xs text-gray-400">{new Date(j.scheduledAt).toLocaleDateString()}</p>
                    </div>
                    <p className="font-medium text-sm">{formatCurrency(j.estimatedTotal || 0)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fleet Accounts */}
        <Card>
          <CardHeader><CardTitle className="text-base">Fleet Accounts</CardTitle></CardHeader>
          <CardContent className="p-0">
            {fleetAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No fleet accounts yet.</p>
            ) : (
              <div className="divide-y max-h-64 overflow-y-auto">
                {fleetAccounts.map((f: {
                  id: string;
                  company: string;
                  vehicleCount: number;
                  monthlyValue: number;
                  lastJobAt: string;
                }) => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <p className="text-sm font-medium">{f.company}</p>
                      <p className="text-xs text-gray-500">{f.vehicleCount} vehicles</p>
                      {f.lastJobAt && <p className="text-xs text-gray-400">Last job: {new Date(f.lastJobAt).toLocaleDateString()}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(f.monthlyValue)}/mo</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
