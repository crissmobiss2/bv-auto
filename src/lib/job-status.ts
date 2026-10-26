import { JobStatus } from "@prisma/client";

const S = JobStatus;

// Forward moves any non-technician staff member may make.
const ALLOWED: Record<JobStatus, JobStatus[]> = {
  ESTIMATE: [S.PENDING_APPROVAL, S.APPROVED, S.SCHEDULED, S.CANCELLED],
  PENDING_APPROVAL: [S.ESTIMATE, S.APPROVED, S.SCHEDULED, S.CANCELLED],
  APPROVED: [S.PENDING_APPROVAL, S.SCHEDULED, S.IN_PROGRESS, S.CANCELLED],
  SCHEDULED: [S.APPROVED, S.IN_PROGRESS, S.CANCELLED],
  IN_PROGRESS: [S.SCHEDULED, S.PARTS_WAITING, S.COMPLETED, S.CANCELLED],
  PARTS_WAITING: [S.IN_PROGRESS, S.SCHEDULED, S.COMPLETED, S.CANCELLED],
  COMPLETED: [S.INVOICED, S.PAID, S.WARRANTY],
  INVOICED: [S.PAID, S.WARRANTY],
  PAID: [S.WARRANTY],
  CANCELLED: [],
  WARRANTY: [S.IN_PROGRESS, S.COMPLETED],
};

// Reopening finished or cancelled work is a supervisor action.
const REOPEN: Partial<Record<JobStatus, { to: JobStatus[]; roles: string[] }>> = {
  COMPLETED: { to: [S.IN_PROGRESS], roles: ["ADMIN", "DISPATCHER"] },
  CANCELLED: { to: [S.ESTIMATE, S.SCHEDULED], roles: ["ADMIN", "DISPATCHER"] },
  INVOICED: { to: [S.COMPLETED], roles: ["ADMIN"] },
};

const TECH_STATUSES: JobStatus[] = [S.APPROVED, S.SCHEDULED, S.IN_PROGRESS, S.PARTS_WAITING, S.COMPLETED];

/** Returns null when the move is allowed, otherwise a user-facing reason. */
export function transitionError(from: JobStatus, to: JobStatus, role: string): string | null {
  if (from === to) return null;
  if (role === "TECHNICIAN" && (!TECH_STATUSES.includes(from) || !TECH_STATUSES.includes(to) || to === S.APPROVED)) {
    return "Technicians can only move a job between scheduled, in progress, parts waiting and completed";
  }
  if (ALLOWED[from].includes(to)) return null;
  const reopen = REOPEN[from];
  if (reopen?.to.includes(to)) {
    return reopen.roles.includes(role) ? null : `Only ${reopen.roles.join(" or ").toLowerCase()} can reopen a ${label(from)} job`;
  }
  return `A ${label(from)} job can't be moved to ${label(to)}`;
}

export function allowedNextStatuses(from: JobStatus, role: string): JobStatus[] {
  return (Object.values(S) as JobStatus[]).filter((to) => to !== from && transitionError(from, to, role) === null);
}

const label = (s: JobStatus) => s.toLowerCase().replace(/_/g, " ");
