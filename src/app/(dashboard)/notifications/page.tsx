"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import {
  AlertTriangle, Clock, Package, Wrench, Shield, CalendarCheck, BarChart2,
  CheckCircle, Bell, ArrowRight,
} from "lucide-react";

type NotifItem = {
  id: string;
  type: "urgent" | "warning" | "info" | "success";
  icon: React.ElementType;
  title: string;
  message: string;
  href: string;
  time?: string;
};

export default function NotificationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications-v2"],
    queryFn: () => axios.get("/api/notifications").then(r => r.data),
    refetchInterval: 60_000,
  });

  const notifications: NotifItem[] = [];

  if (data) {
    // Overdue invoices — urgent
    data.overdueInvoices?.forEach((inv: { id: string; invoiceNumber: string; amountDue: number; customer: { firstName: string; lastName: string }; dueDate?: string }) => {
      notifications.push({
        id: `inv-${inv.id}`,
        type: "urgent",
        icon: AlertTriangle,
        title: `Overdue Invoice — ${inv.invoiceNumber}`,
        message: `${inv.customer.firstName} ${inv.customer.lastName} · ${formatCurrency(inv.amountDue)} past due`,
        href: `/invoices/${inv.id}`,
        time: inv.dueDate,
      });
    });

    // Jobs with no technician assigned — warning
    data.unassignedJobs?.forEach((job: { id: string; jobNumber: string; title: string; scheduledAt?: string; customer: { firstName: string; lastName: string } }) => {
      notifications.push({
        id: `unassigned-${job.id}`,
        type: "warning",
        icon: Wrench,
        title: `No Technician Assigned — ${job.jobNumber}`,
        message: `${job.customer.firstName} ${job.customer.lastName} · ${job.title}`,
        href: `/jobs/${job.id}`,
        time: job.scheduledAt,
      });
    });

    // Parts to order — warning
    data.requestedParts?.forEach((part: { id: string; description: string; partNumber?: string; requestedAt: string; job: { id: string; jobNumber: string } }) => {
      notifications.push({
        id: `part-${part.id}`,
        type: "warning",
        icon: Package,
        title: `Part Needs Ordering — ${part.partNumber || part.description}`,
        message: `Job ${part.job.jobNumber} · ${part.description}`,
        href: `/jobs/${part.job.id}`,
        time: part.requestedAt,
      });
    });

    // Pending approval — info
    data.pendingApprovalJobs?.forEach((job: { id: string; jobNumber: string; title: string; createdAt: string; customer: { firstName: string; lastName: string } }) => {
      notifications.push({
        id: `approval-${job.id}`,
        type: "info",
        icon: Clock,
        title: `Quote Awaiting Approval — ${job.jobNumber}`,
        message: `${job.customer.firstName} ${job.customer.lastName} · ${job.title}`,
        href: `/jobs/${job.id}`,
        time: job.createdAt,
      });
    });

    // Today's jobs — info
    data.jobsScheduledToday?.forEach((job: { id: string; jobNumber: string; title: string; scheduledAt?: string; status: string; customer: { firstName: string; lastName: string }; technician?: { name: string } }) => {
      notifications.push({
        id: `today-${job.id}`,
        type: "info",
        icon: CalendarCheck,
        title: `Today — ${job.jobNumber}: ${job.title}`,
        message: `${job.customer.firstName} ${job.customer.lastName}${job.technician ? ` · ${job.technician.name}` : " · Unassigned"}`,
        href: `/jobs/${job.id}`,
        time: job.scheduledAt,
      });
    });

    // Warranties expiring soon — warning
    data.warrantiesExpiring?.forEach((w: { id: string; description: string; expiryDate: string; job: { id: string; jobNumber: string; customer: { firstName: string; lastName: string } } }) => {
      notifications.push({
        id: `warranty-${w.id}`,
        type: "warning",
        icon: Shield,
        title: `Warranty Expiring Soon — ${w.description}`,
        message: `${w.job.customer.firstName} ${w.job.customer.lastName} · Job ${w.job.jobNumber}`,
        href: `/warranty`,
        time: w.expiryDate,
      });
    });

    // Maintenance due — info
    data.maintenanceDue?.forEach((m: { id: string; serviceName: string; nextDueDate: string; vehicle: { id: string; year: number; make: string; model: string; customer: { firstName: string; lastName: string } } }) => {
      notifications.push({
        id: `maint-${m.id}`,
        type: "info",
        icon: Wrench,
        title: `Maintenance Due — ${m.serviceName}`,
        message: `${m.vehicle.customer.firstName} ${m.vehicle.customer.lastName} · ${m.vehicle.year} ${m.vehicle.make} ${m.vehicle.model}`,
        href: `/vehicles/${m.vehicle.id}`,
        time: m.nextDueDate,
      });
    });

    // Low inventory — warning
    data.lowInventory?.forEach((item: { id: string; name: string; partNumber?: string; quantityOnHand: number; reorderPoint: number }) => {
      notifications.push({
        id: `inv-low-${item.id}`,
        type: "warning",
        icon: BarChart2,
        title: `Low Stock — ${item.name}`,
        message: `${item.quantityOnHand} remaining${item.reorderPoint ? ` (reorder at ${item.reorderPoint})` : ""}${item.partNumber ? ` · ${item.partNumber}` : ""}`,
        href: `/inventory`,
      });
    });
  }

  // Sort: urgent first, then by time desc
  const ORDER = { urgent: 0, warning: 1, info: 2, success: 3 };
  notifications.sort((a, b) => ORDER[a.type] - ORDER[b.type]);

  const typeStyles: Record<string, string> = {
    urgent: "border-l-red-500 bg-red-50",
    warning: "border-l-orange-400 bg-orange-50",
    info: "border-l-blue-400 bg-blue-50",
    success: "border-l-green-400 bg-green-50",
  };
  const iconStyles: Record<string, string> = {
    urgent: "text-red-500",
    warning: "text-orange-500",
    info: "text-blue-500",
    success: "text-green-500",
  };

  const counts = data?.counts || {};
  const totalUrgent = (counts.overdue || 0) + (counts.unassigned || 0);
  const totalWarning = (counts.partsToOrder || 0) + (counts.warrantiesExpiring || 0) + (counts.lowInventory || 0);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Bell className="h-6 w-6" /> Notifications
          {totalUrgent > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalUrgent}</span>
          )}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Everything requiring your attention — updated every minute</p>
      </div>

      {/* Summary grid */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Overdue Invoices", value: counts.overdue, icon: AlertTriangle, color: "text-red-600 bg-red-50", href: "/invoices?status=OVERDUE" },
            { label: "Parts to Order", value: counts.partsToOrder, icon: Package, color: "text-orange-600 bg-orange-50", href: "/parts?status=REQUESTED" },
            { label: "Pending Approval", value: counts.pendingApproval, icon: Clock, color: "text-blue-600 bg-blue-50", href: "/jobs?status=PENDING_APPROVAL" },
            { label: "Unassigned Jobs", value: counts.unassigned, icon: Wrench, color: "text-yellow-600 bg-yellow-50", href: "/schedule" },
          ].map(({ label, value, icon: Icon, color, href }) => (
            <Link key={label} href={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xl font-bold">{value ?? 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Secondary stats */}
      {!isLoading && data && (counts.warrantiesExpiring > 0 || counts.maintenanceDue > 0 || counts.lowInventory > 0 || counts.todayJobs > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Today's Jobs", value: counts.todayJobs, icon: CalendarCheck, color: "text-green-600 bg-green-50", href: "/schedule" },
            { label: "Maint. Due (7d)", value: counts.maintenanceDue, icon: Wrench, color: "text-purple-600 bg-purple-50", href: "/vehicles" },
            { label: "Warranties Expiring", value: counts.warrantiesExpiring, icon: Shield, color: "text-indigo-600 bg-indigo-50", href: "/warranty" },
            { label: "Low Inventory", value: counts.lowInventory, icon: BarChart2, color: "text-pink-600 bg-pink-50", href: "/inventory" },
          ].filter(s => s.value > 0).map(({ label, value, icon: Icon, color, href }) => (
            <Link key={label} href={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xl font-bold">{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Notification list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="font-semibold text-gray-700 dark:text-gray-300">All caught up!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">No items require your attention right now.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  className={`flex items-start gap-3 p-4 hover:bg-white/80 transition-colors border-l-4 ${typeStyles[n.type]} block`}
                >
                  <n.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconStyles[n.type]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.message}</p>
                    {n.time && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(n.time)}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
