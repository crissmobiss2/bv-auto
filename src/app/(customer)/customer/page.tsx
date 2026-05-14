"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Car, FileText, Clock, AlertTriangle, CheckCircle,
  CalendarCheck, ChevronRight, Wrench, DollarSign, Phone
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-purple-100 text-purple-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
};

export default function CustomerDashboard() {
  const { data: session } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-dashboard"],
    queryFn: () => axios.get("/api/customer/dashboard").then(r => r.data),
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const { customer, vehicles = [], recentJobs = [], openInvoices = [], stats = {} } = data || {};

  return (
    <div className="space-y-4">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <p className="text-blue-200 text-sm">Welcome back,</p>
        <h1 className="text-xl font-bold mt-0.5">
          {customer ? `${customer.firstName} ${customer.lastName}` : session?.user?.name}
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <Link href="/book">
            <Button size="sm" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold">
              <CalendarCheck className="h-4 w-4 mr-1.5" /> Book Service
            </Button>
          </Link>
          <a href="tel:+1">
            <Button size="sm" variant="ghost" className="text-white hover:bg-blue-500 border border-white/30">
              <Phone className="h-4 w-4 mr-1.5" /> Call Us
            </Button>
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Vehicles", value: stats.totalVehicles ?? 0, icon: Car, color: "text-blue-600 bg-blue-50" },
          { label: "Open Balance", value: formatCurrency(stats.openBalance ?? 0), icon: DollarSign, color: stats.openBalance > 0 ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50" },
          { label: "Total Services", value: stats.totalJobs ?? 0, icon: Wrench, color: "text-purple-600 bg-purple-50" },
          { label: "Lifetime Spend", value: formatCurrency(stats.totalSpend ?? 0), icon: CheckCircle, color: "text-green-600 bg-green-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Open invoices */}
      {openInvoices.length > 0 && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3 text-red-700">
              <AlertTriangle className="h-4 w-4" /> Outstanding Invoices
            </h3>
            <div className="space-y-2">
              {openInvoices.map((inv: { id: string; invoiceNumber: string; status: string; amountDue: number; dueDate?: string; job?: { title: string; jobNumber: string } }) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">{inv.job?.title || "Service"}{inv.dueDate ? ` · Due ${formatDateTime(inv.dueDate)}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{formatCurrency(inv.amountDue)}</p>
                    <Badge className="text-xs bg-red-100 text-red-700 mt-1">{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicles */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Car className="h-4 w-4 text-blue-600" /> My Vehicles
            </h3>
            <Link href="/customer/vehicles" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {vehicles.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No vehicles on file yet</p>
          ) : (
            <div className="space-y-2">
              {vehicles.slice(0, 3).map((v: { id: string; year: number; make: string; model: string; trim?: string; mileage?: number; maintenanceIntervals?: { serviceName: string; nextDueDate: string }[] }) => (
                <Link key={v.id} href="/customer/vehicles"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Car className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ""}</p>
                      {v.mileage && <p className="text-xs text-gray-500">{v.mileage.toLocaleString()} mi</p>}
                    </div>
                  </div>
                  {(v.maintenanceIntervals?.length ?? 0) > 0 && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      {v.maintenanceIntervals!.length} due
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent service */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" /> Recent Service
            </h3>
            <Link href="/customer/history" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No service history yet</p>
          ) : (
            <div className="space-y-2">
              {recentJobs.slice(0, 4).map((job: { id: string; jobNumber: string; title: string; status: string; scheduledAt?: string; vehicle?: { year: number; make: string; model: string } }) => (
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-gray-500">
                      {job.vehicle ? `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}` : ""}
                      {job.scheduledAt ? ` · ${formatDateTime(job.scheduledAt)}` : ""}
                    </p>
                  </div>
                  <Badge className={`text-xs flex-shrink-0 ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>
                    {job.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Book appointment CTA */}
      <Card className="bg-gradient-to-r from-gray-900 to-gray-800 border-0 text-white">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold">Need service?</p>
            <p className="text-sm text-gray-400 mt-0.5">We come to you — mobile repair at your location</p>
          </div>
          <Link href="/book">
            <Button className="bg-blue-500 hover:bg-blue-400 flex-shrink-0">
              Book <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
