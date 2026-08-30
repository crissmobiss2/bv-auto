import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import crypto from "crypto";

/**
 * Authorize a cron request. Fail-closed: rejects when CRON_SECRET is unset
 * (the old `header !== process.env.CRON_SECRET` check was OPEN in that case),
 * uses constant-time comparison, and never bypasses in non-production.
 * Returns a NextResponse to short-circuit, or null when authorized.
 */
export function assertCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  const provided = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Every non-customer role. Use to keep CUSTOMER accounts out of staff APIs. */
export const STAFF_ROLES = [
  "ADMIN",
  "DISPATCHER",
  "TECHNICIAN",
  "PARTS_COORDINATOR",
  "ACCOUNTANT",
  "SERVICE_ADVISOR",
] as const;

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireRole(roles: readonly string[]) {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };
  if (!roles.includes(session!.user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}

/** Requires any staff (non-customer) role. */
export async function requireStaff() {
  return requireRole(STAFF_ROLES);
}

/**
 * Requires a staff session that belongs to a shop, and returns that `shopId`
 * for tenant-scoping queries. Pass explicit `roles` to further restrict.
 * Usage: `const { error, session, shopId } = await requireShop(); if (error) return error;`
 */
export async function requireShop(roles?: readonly string[]) {
  const { error, session } = roles ? await requireRole(roles) : await requireStaff();
  if (error) return { error, session: null, shopId: "" };
  const shopId = session!.user.shopId;
  if (!shopId) {
    return {
      error: NextResponse.json({ error: "No shop assigned to this account" }, { status: 403 }),
      session: null,
      shopId: "",
    };
  }
  return { error: null, session, shopId };
}

export async function logAudit(
  userId: string | null,
  action: AuditAction,
  entity: string,
  entityId: string,
  before?: object | null,
  after?: object | null,
  notes?: string
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      notes,
    },
  });
}

/**
 * Allowlist helper for update payloads: returns a new object containing only
 * `keys` that are present on `obj`. Use on every PATCH to block mass-assignment
 * of sensitive columns (ids, shopId, portalToken, money fields, timestamps).
 */
export function pick<T extends object>(obj: unknown, keys: readonly string[]): Partial<T> {
  const src = (obj ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
  }
  return out as Partial<T>;
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
