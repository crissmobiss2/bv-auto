"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, DollarSign, Wrench, Users, FileText, Download, TrendingDown, Award, Target, PieChart as PieIcon, GitPullRequest, Clock, XCircle } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#065f46"];

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => axios.get("/api/reports").then((r) => r.data),
  });

  const { data: convData } = useQuery({
    queryKey: ["quote-conversions"],
    queryFn: () => axios.get("/api/quotes/conversions").then((r) => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading reports...</div>;

  const d = data || {};
  const summary = d.summary || {};

  const statCards = [
    { title: "Revenue (30 days)", value: formatCurrency(summary.revenue30 || 0), icon: DollarSign, sub: `${formatCurrency(summary.revenue90 || 0)} (90 days)`, color: "text-blue-600 bg-blue-50" },
    { title: "Revenue YTD", value: formatCurrency(summary.revenueYTD || 0), icon: TrendingUp, sub: "Year to date", color: "text-blue-600 bg-blue-50" },
    { title: "Gross Profit (30d)", value: formatCurrency(summary.gpAmount || 0), icon: TrendingUp, sub: `${summary.gpPercent || 0}% GP margin`, color: summary.gpPercent >= 50 ? "text-green-600 bg-green-50" : "text-yellow-600 bg-yellow-50" },
    { title: "Jobs Completed (30d)", value: summary.jobsCompleted30 || 0, icon: Wrench, sub: "Completed or paid", color: "text-purple-600 bg-purple-50" },
    { title: "Avg Job Value", value: formatCurrency(summary.avgJobValue || 0), icon: FileText, sub: "On paid invoices", color: "text-indigo-600 bg-indigo-50" },
    { title: "Total Customers", value: summary.customerCount || 0, icon: Users, sub: `+${summary.newCustomers30 || 0} new this month`, color: "text-teal-600 bg-teal-50" },
    { title: "Open AR", value: formatCurrency(summary.openInvoiceTotal || 0), icon: TrendingDown, sub: "Outstanding balance", color: "text-red-600 bg-red-50" },
    { title: "Returning Customers", value: summary.returningCustomers || 0, icon: Target, sub: "Came back (90 days)", color: "text-green-600 bg-green-50" },
  ];

  const jobStatusData = (d.jobsByStatus || []).map((j: { status: string; _count: { id: number } }) => ({
    name: j.status.replace(/_/g, " "),
    value: j._count.id,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <a href="/api/invoices/export" download>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export CSV (QuickBooks)</Button>
        </a>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{card.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue by month */}
      {d.revenueByMonth?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue — Last 12 Months</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={d.revenueByMonth}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top customers */}
        {d.topCustomers?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Top Customers by Revenue</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.topCustomers} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Revenue"]} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Jobs by status */}
        {jobStatusData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Jobs by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={jobStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                    {jobStatusData.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top services */}
        {d.topServices?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Top Services</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {d.topServices.map((s: { description: string; _count: { id: number } }, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 truncate max-w-[70%]">{s.description}</span>
                        <span className="font-medium">{s._count.id}×</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((s._count.id / (d.topServices[0]._count.id)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parts status */}
        {d.partsStats?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Parts Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {d.partsStats.map((p: { status: string; _count: { id: number } }) => (
                  <div key={p.status} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{p.status.replace(/_/g, " ")}</span>
                    <span className="font-medium">{p._count.id}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* GP by Line Item Type */}
      {d.gpByType?.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <PieIcon className="h-5 w-5 text-green-600" /> Gross Profit by Category (30 days)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.gpByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Revenue"]} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {d.gpByType.map((_: unknown, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Revenue Breakdown</p>
                {(() => {
                  const total = d.gpByType.reduce((s: number, t: { revenue: number }) => s + t.revenue, 0);
                  return d.gpByType.map((t: { type: string; revenue: number; count: number }, i: number) => (
                    <div key={t.type} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{t.type}</span>
                        <span>{formatCurrency(t.revenue)} <span className="text-gray-400">({total > 0 ? Math.round((t.revenue / total) * 100) : 0}%)</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-2 rounded-full" style={{ width: `${total > 0 ? (t.revenue / total) * 100 : 0}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <p className="text-xs text-gray-400">{t.count} line items</p>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Quote Conversion Funnel */}
      {convData && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-blue-600" /> Estimate-to-Invoice Conversion
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg text-blue-600 bg-blue-50"><GitPullRequest className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold">{convData.rate30}%</p>
                  <p className="text-xs text-gray-500">Approval Rate (30d)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg text-green-600 bg-green-50"><Clock className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold">{convData.avgHoursToApprove ?? "—"}h</p>
                  <p className="text-xs text-gray-500">Avg Hours to Approve</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg text-purple-600 bg-purple-50"><Target className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold">{convData.rate90}%</p>
                  <p className="text-xs text-gray-500">Approval Rate (90d)</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {convData.funnel?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Quote Status Funnel</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {convData.funnel.map((f: { status: string; count: number }, i: number) => {
                      const max = convData.funnel[0]?.count || 1;
                      return (
                        <div key={f.status}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{f.status.replace(/_/g, " ")}</span>
                            <span className="font-medium">{f.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full" style={{ width: `${(f.count / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            {convData.declineReasons?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" /> Top Decline Reasons</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {convData.declineReasons.map((r: { reason: string; count: number }) => (
                      <div key={r.reason} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate max-w-[75%]">{r.reason}</span>
                        <span className="font-medium text-red-600">{r.count}×</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Technician Scorecards */}
      {d.techScores?.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" /> Technician Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {d.techScores.map((t: { id: string; name: string; completedJobs: number; revenue: number; actualHours: number; billedHours: number; efficiency: number; avgJobRevenue: number }) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">Last 30 days</p>
                    </div>
                    <div className={`text-2xl font-bold ${t.efficiency >= 80 ? "text-green-600" : t.efficiency >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                      {t.efficiency}%
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-400">Jobs Done</p>
                      <p className="font-bold">{t.completedJobs}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="font-bold">{formatCurrency(t.revenue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-400">Hours Worked</p>
                      <p className="font-bold">{t.actualHours}h</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-400">Avg Job Value</p>
                      <p className="font-bold">{formatCurrency(t.avgJobRevenue)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Efficiency</span>
                      <span className="font-medium">{t.billedHours}h / {t.actualHours}h</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${t.efficiency >= 80 ? "bg-green-500" : t.efficiency >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(t.efficiency, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
