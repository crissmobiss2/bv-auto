"use client";

import { Suspense, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ArrowRight, Wrench } from "lucide-react";
import Link from "next/link";
import { formatDateTime, JOB_STATUS_COLORS } from "@/lib/utils";

const JOB_STATUSES = [
  "ALL", "ESTIMATE", "PENDING_APPROVAL", "APPROVED", "SCHEDULED",
  "IN_PROGRESS", "PARTS_WAITING", "COMPLETED", "INVOICED", "PAID", "CANCELLED",
];

function SkeletonRow() {
  return (
    <TableRow>
      {[28, 48, 36, 40, 32, 28, 24, 16].map((w, i) => (
        <TableCell key={i} className={i >= 4 ? "hidden lg:table-cell" : i >= 3 ? "hidden md:table-cell" : i >= 2 ? "hidden sm:table-cell" : ""}>
          <div className="skeleton h-4 rounded" style={{ width: `${w * 3}px`, maxWidth: "100%" }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

function JobsContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["jobs", debouncedSearch, statusFilter],
    queryFn: () =>
      axios.get(`/api/jobs?search=${debouncedSearch}${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}&limit=50`)
        .then(r => r.data),
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const jobs = data?.jobs || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading..." : `${data?.total ?? 0} total`}
            {isFetching && !isLoading && <span className="ml-2 text-blue-400 text-xs">Refreshing…</span>}
          </p>
        </div>
        <Link href="/jobs/new">
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">
            <Plus className="h-4 w-4" /> New Job
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="shadow-none">
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search jobs, customers, vehicles..."
              className="pl-9 h-9 text-sm bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] focus:bg-white dark:focus:bg-white/[0.07] dark:text-white/90 dark:placeholder:text-white/25"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-sm border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map(s => (
                <SelectItem key={s} value={s} className="text-sm">
                  {s === "ALL" ? "All Statuses" : s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs">Job #</TableHead>
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Scheduled</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Technician</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
              </TableBody>
            </Table>
          ) : jobs.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <Wrench className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-700">No jobs found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {debouncedSearch || statusFilter !== "ALL"
                    ? "Try adjusting your search or filter"
                    : "Create your first job to get started"}
                </p>
              </div>
              {!debouncedSearch && statusFilter === "ALL" && (
                <Link href="/jobs/new">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4" /> Create First Job
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 dark:bg-white/[0.03] hover:bg-gray-50/80 dark:hover:bg-white/[0.03]">
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Job #</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Customer</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Vehicle</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Scheduled</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Technician</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job: {
                    id: string; jobNumber: string; title: string; status: string; scheduledAt?: string;
                    customer: { firstName: string; lastName: string };
                    vehicle: { year: number; make: string; model: string };
                    technician?: { name: string };
                  }) => (
                    <TableRow key={job.id} className="group hover:bg-blue-50/30 transition-colors">
                      <TableCell className="font-mono text-xs text-gray-500">{job.jobNumber}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm text-gray-900 truncate max-w-[180px] group-hover:text-blue-700 transition-colors">
                          {job.title}
                        </p>
                        {/* Mobile: show customer under title */}
                        <p className="sm:hidden text-xs text-gray-500 mt-0.5">
                          {job.customer.firstName} {job.customer.lastName}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-gray-700">
                        {job.customer.firstName} {job.customer.lastName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-gray-500">
                        {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-gray-500">
                        {job.scheduledAt ? formatDateTime(job.scheduledAt) : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-gray-500">
                        {job.technician?.name || <span className="text-gray-300">Unassigned</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs font-medium ${JOB_STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>
                          {job.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-3">
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    }>
      <JobsContent />
    </Suspense>
  );
}
