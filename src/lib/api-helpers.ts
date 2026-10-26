import { openShopScope } from "@/lib/tenant";
import { redactAuditPayload } from "@/lib/audit-redact";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";

/** The shop a signed-in user works in; tokens issued before multi-shop fall back to the DB. */
export async function resolveShopId(user: { id: string; shopId?: string | null }) {
  if (user.shopId) return user.shopId;
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { shopId: true } });
  return row?.shopId ?? null;
}

/** Binds the caller to the user's shop; await it before any tenant query. */
export async function requireAuth() {
  const scope = openShopScope();
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  const shopId = await resolveShopId(session.user);
  if (!shopId) return { error: NextResponse.json({ error: "No shop for this account" }, { status: 403 }), session: null };
  scope.shopId = shopId;
  return { error: null, session };
}

export async function requireRole(roles: string[]) {
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
      before: before ? redactAuditPayload(JSON.parse(JSON.stringify(before))) : undefined,
      after: after ? redactAuditPayload(JSON.parse(JSON.stringify(after))) : undefined,
      notes,
    },
  });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
