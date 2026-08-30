import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Wrench, DollarSign, FileText, AlertTriangle,
  Calendar, Package, ArrowRight, Clock, TrendingUp, Users, CheckCircle,
  Zap, Activity,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDateTime, JOB_STATUS_COLORS } from "@/lib/utils";

async function getDashboardData() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tomorrow = new Date(startOfToday.getTime() + 86400000);

  const [
    openJobs, jobsToday, pendingInvoices, overdueInvoices,
    partsWaiting, revenueMonth, completedToday, invoicesThisMonth,
    inProgressNow, recentJobs, upcomingJobs,
  ] = await Promise.all([
    prisma.job.count({ where: { status: { in: ["ESTIMATE","PENDING_APPROVAL","APPROVED","SCHEDULED","IN_PROGRESS","PARTS_WAITING"] } } }),
    prisma.job.count({ where: { scheduledAt: { gte: startOfToday, lt: tomorrow } } }),
    prisma.invoice.count({ where: { status: { in: ["SENT","VIEWED","PARTIAL"] } } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.jobPart.count({ where: { status: { in: ["REQUESTED","QUOTED","ORDERED","SHIPPED"] } } }),
    prisma.payment.aggregate({ where: { receivedAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.job.count({ where: { completedAt: { gte: startOfToday, lt: tomorrow } } }),
    prisma.invoice.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: { in: ["PAID","PARTIAL","SENT","VIEWED"] } },
      _avg: { totalAmount: true },
      _count: true,
    }),
    prisma.job.count({ where: { status: "IN_PROGRESS" } }),
    prisma.job.findMany({
      where: { status: { notIn: ["CANCELLED","PAID"] } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        vehicle: { select: { year: true, make: true, model: true } },
        technician: { select: { name: true } },
      },
      orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.job.findMany({
      where: { scheduledAt: { gte: startOfToday }, status: { in: ["SCHEDULED","APPROVED"] } },
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
      completedToday,
      avgRoValue: Number(invoicesThisMonth._avg.totalAmount ?? 0),
      roCount: invoicesThisMonth._count,
      inProgressNow,
    },
    recentJobs,
    upcomingJobs,
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default async function DashboardPage() {
  const session = await auth();
  const customerCount = await prisma.customer.count();
  if (customerCount === 0) redirect("/onboarding");

  const { stats, recentJobs, upcomingJobs } = await getDashboardData();
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6 pb-8 animate-fade-in">

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Good {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
            Here&apos;s what&apos;s happening at B&amp;V today.
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-600/20 transition-all hover:shadow-lg hover:shadow-blue-600/25 hover:-translate-y-px active:translate-y-0"
        >
          <Wrench className="h-4 w-4" />
          New Job
        </Link>
      </div>

      {/* ── Primary stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Open Jobs"        value={stats.openJobs}                     icon={Wrench}        color="blue"   href="/jobs"                   delay={0} />
        <StatCard title="Today"            value={stats.jobsToday}                    icon={Calendar}      color="indigo" href="/dispatch"                delay={1} />
        <StatCard title="Pending Invoices" value={stats.pendingInvoices}              icon={FileText}      color="amber"  href="/invoices?status=SENT"    delay={2} />
        <StatCard title="Overdue"          value={stats.overdueInvoices}              icon={AlertTriangle} color="red"    href="/invoices?status=OVERDUE" delay={3} urgent={stats.overdueInvoices > 0} />
        <StatCard title="Parts Pending"    value={stats.partsWaiting}                 icon={Package}       color="purple" href="/parts"                   delay={4} />
        <StatCard title="Revenue MTD"      value={formatCurrency(stats.revenueMonth)} icon={DollarSign}    color="green"  href="/reports"                 delay={5} />
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Avg RO Value"
          value={stats.avgRoValue > 0 ? formatCurrency(stats.avgRoValue) : "—"}
          sub={stats.roCount > 0 ? `${stats.roCount} ROs this month` : "No invoices yet"}
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          accent="emerald"
          href="/reports"
        />
        <KpiCard
          label="Completed Today"
          value={String(stats.completedToday)}
          sub="vehicles finished"
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          accent="green"
          href="/jobs?status=COMPLETED"
        />
        <KpiCard
          label="In Bay Now"
          value={String(stats.inProgressNow)}
          sub="actively being worked on"
          icon={<Zap className="h-4 w-4 text-blue-500" />}
          accent="blue"
          href="/jobs?status=IN_PROGRESS"
          pulse={stats.inProgressNow > 0}
        />
        <KpiCard
          label="Customers"
          value="—"
          sub="view in Reports"
          icon={<Users className="h-4 w-4 text-violet-500" />}
          accent="violet"
          href="/customers"
        />
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Active jobs table */}
        <div className="lg:col-span-2 animate-fade-in-up stagger-2">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-200/80 dark:border-white/[0.07] overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-gray-400 dark:text-white/30" />
                <span className="text-xs font-semibold text-gray-600 dark:text-white/60 uppercase tracking-widest">Active Jobs</span>
              </div>
              <Link href="/jobs" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {recentJobs.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] flex items-center justify-center">
                  <Wrench className="h-6 w-6 text-gray-300 dark:text-white/20" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-white/70">No active jobs</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Create your first job to get started</p>
                </div>
                <Link
                  href="/jobs/new"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors"
                >
                  <Wrench className="h-3 w-3" /> Create a job
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white/90 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {job.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                        {job.customer.firstName} {job.customer.lastName}
                        <span className="text-gray-300 dark:text-white/15 mx-1.5">·</span>
                        {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </p>
                      {job.scheduledAt && (
                        <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(job.scheduledAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {job.technician && (
                        <span className="text-xs text-gray-400 dark:text-white/30 hidden md:block">{job.technician.name}</span>
                      )}
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${JOB_STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-white/50"}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Today's schedule */}
        <div className="animate-fade-in-up stagger-3">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-200/80 dark:border-white/[0.07] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-white/30" />
                <span className="text-xs font-semibold text-gray-600 dark:text-white/60 uppercase tracking-widest">Today&apos;s Schedule</span>
              </div>
            </div>

            {upcomingJobs.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <Calendar className="h-10 w-10 text-gray-200 dark:text-white/10" />
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-white/50">Nothing scheduled</p>
                  <p className="text-xs text-gray-400 dark:text-white/25 mt-0.5">Your day is clear</p>
                </div>
                <Link href="/schedule" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold transition-colors">
                  Open Schedule →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {upcomingJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group block px-5 py-3.5 hover:bg-gray-50/70 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white/90 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {job.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-0.5">
                          {job.customer.firstName} {job.customer.lastName}
                        </p>
                      </div>
                      {job.scheduledAt && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex-shrink-0 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-md font-nums">
                          {new Date(job.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {job.technician && (
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-1">{job.technician.name}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

type StatColor = "blue" | "indigo" | "amber" | "red" | "purple" | "green";

const STAT_COLORS: Record<StatColor, { icon: string; bg: string; border: string; glow: string }> = {
  blue:   { icon: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-500/10",   border: "border-blue-100/80 dark:border-blue-500/20",   glow: "hover:shadow-blue-100/60 dark:hover:shadow-blue-500/10" },
  indigo: { icon: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-100/80 dark:border-indigo-500/20", glow: "hover:shadow-indigo-100/60 dark:hover:shadow-indigo-500/10" },
  amber:  { icon: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-500/10",  border: "border-amber-100/80 dark:border-amber-500/20",  glow: "hover:shadow-amber-100/60 dark:hover:shadow-amber-500/10" },
  red:    { icon: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-500/10",    border: "border-red-100/80 dark:border-red-500/20",    glow: "hover:shadow-red-100/60 dark:hover:shadow-red-500/10" },
  purple: { icon: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-purple-100/80 dark:border-purple-500/20", glow: "hover:shadow-purple-100/60 dark:hover:shadow-purple-500/10" },
  green:  { icon: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-500/10",  border: "border-green-100/80 dark:border-green-500/20",  glow: "hover:shadow-green-100/60 dark:hover:shadow-green-500/10" },
};

function StatCard({ title, value, icon: Icon, color, href, urgent = false, delay = 0 }: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: StatColor;
  href: string;
  urgent?: boolean;
  delay?: number;
}) {
  const c = STAT_COLORS[color];
  const delayClass = ["", "stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-5"][delay] || "";

  return (
    <Link href={href}>
      <div className={`group relative bg-white dark:bg-[#111827] rounded-xl p-4 border border-gray-200/80 dark:border-white/[0.07] shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-px active:translate-y-0 animate-fade-in-up ${delayClass} ${urgent ? "ring-1 ring-red-300 dark:ring-red-500/40" : ""}`}>
        {urgent && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
        <div className={`inline-flex p-2 rounded-lg ${c.bg} border ${c.border} mb-3 group-hover:scale-105 transition-transform`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
        <p className="text-xl font-bold text-gray-900 dark:text-white leading-none font-nums tracking-tight">
          {value}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-white/35 mt-1 font-medium leading-tight">{title}</p>
      </div>
    </Link>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, href, pulse = false }: {
  label: string; value: string; sub: string; icon: React.ReactNode; href: string; accent: string; pulse?: boolean;
}) {
  return (
    <Link href={href}>
      <div className="group bg-white dark:bg-[#111827] rounded-xl p-4 border border-gray-200/80 dark:border-white/[0.07] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-px active:translate-y-0 animate-fade-in-up stagger-2">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${pulse ? "animate-pulse" : ""}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-none truncate font-nums tracking-tight">{value}</p>
            <p className="text-[10px] font-bold text-gray-500 dark:text-white/40 uppercase tracking-widest mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5 truncate">{sub}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
