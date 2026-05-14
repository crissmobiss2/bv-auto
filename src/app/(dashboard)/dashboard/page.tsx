import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench, DollarSign, FileText, AlertTriangle,
  Calendar, Package, ArrowRight, Clock,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDateTime, JOB_STATUS_COLORS } from "@/lib/utils";

async function getDashboardData() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    openJobs,
    jobsToday,
    pendingInvoices,
    overdueInvoices,
    partsWaiting,
    revenueMonth,
    recentJobs,
    upcomingJobs,
  ] = await Promise.all([
    prisma.job.count({
      where: { status: { in: ["ESTIMATE", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "IN_PROGRESS", "PARTS_WAITING"] } },
    }),
    prisma.job.count({
      where: { scheduledAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) } },
    }),
    prisma.invoice.count({ where: { status: { in: ["SENT", "VIEWED", "PARTIAL"] } } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.jobPart.count({ where: { status: { in: ["REQUESTED", "QUOTED", "ORDERED", "SHIPPED"] } } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.job.findMany({
      where: { status: { notIn: ["CANCELLED", "PAID"] } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        vehicle: { select: { year: true, make: true, model: true } },
        technician: { select: { name: true } },
      },
      orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.job.findMany({
      where: { scheduledAt: { gte: startOfToday }, status: { in: ["SCHEDULED", "APPROVED"] } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        vehicle: { select: { year: true, make: true, model: true } },
        technician: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  return {
    stats: {
      openJobs, jobsToday, pendingInvoices, overdueInvoices,
      partsWaiting, revenueMonth: Number(revenueMonth._sum.amount ?? 0),
    },
    recentJobs,
    upcomingJobs,
  };
}

export default async function DashboardPage() {
  const session = await auth();

  const customerCount = await prisma.customer.count();
  if (customerCount === 0) redirect("/onboarding");

  const { stats, recentJobs, upcomingJobs } = await getDashboardData();

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Good {getGreeting()}, {session?.user?.name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Here&apos;s what&apos;s happening at B&amp;V today.
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Wrench className="h-4 w-4" />
          New Job
        </Link>
      </div>

      {/* Stats Grid — 2 col mobile, 3 col sm, 6 col lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Open Jobs"         value={stats.openJobs}                      icon={Wrench}        color="blue"   href="/jobs" />
        <StatCard title="Today"             value={stats.jobsToday}                     icon={Calendar}      color="indigo" href="/dispatch" />
        <StatCard title="Pending Invoices"  value={stats.pendingInvoices}               icon={FileText}      color="amber"  href="/invoices?status=SENT" />
        <StatCard title="Overdue"           value={stats.overdueInvoices}               icon={AlertTriangle} color="red"    href="/invoices?status=OVERDUE" urgent={stats.overdueInvoices > 0} />
        <StatCard title="Parts Pending"     value={stats.partsWaiting}                  icon={Package}       color="purple" href="/parts" />
        <StatCard title="Revenue (MTD)"     value={formatCurrency(stats.revenueMonth)}  icon={DollarSign}    color="green"  href="/reports" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active Jobs */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden shadow-none border-gray-200/80">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-5 bg-gray-50/60 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Active Jobs</CardTitle>
              <Link href="/jobs" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5 transition-colors">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentJobs.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">No active jobs</p>
                    <p className="text-xs text-gray-400 mt-0.5">Create your first job to get started</p>
                  </div>
                  <Link href="/jobs/new" className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                    + Create a job
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentJobs.map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}
                      className="group flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                          {job.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {job.customer.firstName} {job.customer.lastName}
                          <span className="text-gray-300 mx-1">·</span>
                          {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                        </p>
                        {job.scheduledAt && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(job.scheduledAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {job.technician && (
                          <span className="text-xs text-gray-400 hidden md:block">{job.technician.name}</span>
                        )}
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${JOB_STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule */}
        <div>
          <Card className="overflow-hidden shadow-none border-gray-200/80">
            <CardHeader className="py-3 px-5 bg-gray-50/60 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Today&apos;s Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingJobs.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-center">
                  <Calendar className="h-8 w-8 text-gray-200" />
                  <p className="text-sm text-gray-400">Nothing scheduled today</p>
                  <Link href="/schedule" className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                    Open Schedule →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcomingJobs.map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}
                      className="group block px-5 py-3 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                            {job.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {job.customer.firstName} {job.customer.lastName}
                          </p>
                        </div>
                        {job.scheduledAt && (
                          <span className="text-xs text-blue-600 font-semibold flex-shrink-0 bg-blue-50 px-1.5 py-0.5 rounded-md">
                            {new Date(job.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      {job.technician && (
                        <p className="text-xs text-gray-400 mt-1">{job.technician.name}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function StatCard({
  title, value, icon: Icon, color, href, urgent = false,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: "blue" | "indigo" | "amber" | "red" | "purple" | "green";
  href: string;
  urgent?: boolean;
}) {
  const colorMap = {
    blue:   { bg: "bg-blue-50",   icon: "text-blue-600",   ring: "ring-blue-100" },
    indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", ring: "ring-indigo-100" },
    amber:  { bg: "bg-amber-50",  icon: "text-amber-600",  ring: "ring-amber-100" },
    red:    { bg: "bg-red-50",    icon: "text-red-600",    ring: "ring-red-100" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", ring: "ring-purple-100" },
    green:  { bg: "bg-green-50",  icon: "text-green-600",  ring: "ring-green-100" },
  };
  const c = colorMap[color];

  return (
    <Link href={href}>
      <Card className={`group hover:shadow-md transition-all duration-150 cursor-pointer border-gray-200/80 shadow-none ${urgent ? "ring-1 ring-red-200" : ""}`}>
        <CardContent className="p-4">
          <div className={`inline-flex p-2 rounded-lg ${c.bg} mb-3 group-hover:scale-105 transition-transform`}>
            <Icon className={`h-4 w-4 ${c.icon}`} />
          </div>
          <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
          <p className="text-[11px] text-gray-500 mt-1 leading-tight">{title}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
