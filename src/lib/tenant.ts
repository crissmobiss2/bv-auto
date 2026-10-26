import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";

// Multi-shop isolation. Every staff request runs with the signed-in user's shopId
// (set by requireAuth); the Prisma extension in prisma.ts then scopes every query.
// Code with no shop context (public token routes, webhooks, crons, login) runs unscoped.

type Store = { shopId: string; created: Set<string> };
const storage = new AsyncLocalStorage<Store>();

export function currentShopId(): string | null {
  return storage.getStore()?.shopId ?? null;
}

/** Bind the rest of the current async flow (e.g. a route handler) to a shop. */
export function enterShop(shopId: string) {
  storage.enterWith({ shopId, created: new Set() });
}

export function runWithShop<T>(shopId: string, fn: () => T): T {
  return storage.run({ shopId, created: new Set() }, fn);
}

/** Models with their own shopId column. */
export const ROOT_MODELS = new Set([
  "User", "Customer", "Vehicle", "Job", "Quote", "Invoice", "Payment", "PartsVendor", "PurchaseOrder",
  "InventoryItem", "CannedService", "ServiceRequest", "MarketingCampaign", "FleetAccount", "CommSequence",
  "SmsMessage", "Communication", "ReviewRequest", "PayrollRun", "AuditLog", "Warranty", "InsuranceClaim",
  "DeclinedService", "FollowUp",
]);

/** Models owned through a parent: scoped by a relation filter on the parent's shopId. */
export const CHILD_SCOPES: Record<string, string[]> = {
  CarfaxRecord: ["vehicle"],
  LineItem: ["quote", "invoice"],
  JobPart: ["job"],
  JobPhoto: ["job"],
  Signature: ["job"],
  Note: ["job", "customer"],
  TimeLog: ["job"],
  InventoryMovement: ["item"],
  PaymentPlanInstallment: ["invoice"],
  MaintenanceInterval: ["vehicle"],
  CommSequenceStep: ["sequence"],
  CommEnrollment: ["sequence"],
  Sublet: ["job"],
  PayrollRate: ["user"],
  PayrollPayout: ["user"],
  TechnicianLocation: ["user"],
  Notification: ["user"],
  PushToken: ["user"],
};

const isTenant = (model: string) => ROOT_MODELS.has(model) || model in CHILD_SCOPES || model === "Shop";

type Field = { name: string; kind: string; type: string };
const MODELS = new Map<string, Field[]>(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, m.fields as unknown as Field[]]),
);
const relationFields = (model: string) => (MODELS.get(model) ?? []).filter((f) => f.kind === "object");

export function scopeFilter(model: string, shopId: string): Record<string, unknown> | null {
  if (model === "Shop") return { id: shopId };
  if (ROOT_MODELS.has(model)) return { shopId };
  const parents = CHILD_SCOPES[model];
  if (!parents) return null;
  const clauses = parents.map((p) => ({ [p]: { shopId } }));
  return clauses.length === 1 ? clauses[0] : { OR: clauses };
}

function andWhere(where: unknown, filter: Record<string, unknown>) {
  const w = (where ?? {}) as Record<string, unknown>;
  const and = w.AND == null ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...and, filter] };
}

type Data = Record<string, unknown>;
const isObj = (v: unknown): v is Data => !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

/** Stamp shopId on a create payload for a root model, recursing into nested creates. */
export function stampCreate(model: string, data: Data, shopId: string): Data {
  const rels = relationFields(model);
  const out: Data = { ...data };
  if (ROOT_MODELS.has(model)) {
    // The caller's shop always wins over a shopId or shop link in the payload.
    delete out.shopId;
    delete out.shop;
    const hasShopRelation = rels.some((f) => f.name === "shop");
    const checked = rels.some((f) => isObj(out[f.name]));
    if (hasShopRelation && checked) out.shop = { connect: { id: shopId } };
    else out.shopId = shopId;
  }
  for (const f of rels) {
    const v = out[f.name];
    if (!isObj(v) || !isTenant(f.type)) continue;
    out[f.name] = stampNested(f.type, v, shopId);
  }
  return out;
}

function stampNested(model: string, ops: Data, shopId: string): Data {
  const each = (x: unknown) => (Array.isArray(x) ? x.map((d) => stampCreate(model, d as Data, shopId)) : stampCreate(model, x as Data, shopId));
  const out: Data = { ...ops };
  if (out.create) out.create = each(out.create);
  if (isObj(out.createMany) && out.createMany.data) out.createMany = { ...out.createMany, data: each(out.createMany.data) };
  if (out.connectOrCreate) {
    const list = Array.isArray(out.connectOrCreate) ? out.connectOrCreate : [out.connectOrCreate];
    const mapped = list.map((c) => ({ ...(c as Data), create: stampCreate(model, (c as Data).create as Data, shopId) }));
    out.connectOrCreate = Array.isArray(out.connectOrCreate) ? mapped : mapped[0];
  }
  if (out.upsert) {
    const list = Array.isArray(out.upsert) ? out.upsert : [out.upsert];
    const mapped = list.map((u) => ({ ...(u as Data), create: stampCreate(model, (u as Data).create as Data, shopId) }));
    out.upsert = Array.isArray(out.upsert) ? mapped : mapped[0];
  }
  return out;
}

const ids = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [v]).flatMap((x) => (isObj(x) && typeof x.id === "string" ? [x.id] : []));
const list = (v: unknown): Data[] => (Array.isArray(v) ? v : [v]).filter(isObj);

/** Every tenant record a write payload links to, including through nested relation writes. */
// A third element `true` marks a connectOrCreate target that may not exist yet.
type Ref = [string, string] | [string, string, true];

export function nestedReferencedIds(model: string, data: Data): Ref[] {
  const refs: Ref[] = referencedIds(model, data);
  for (const f of relationFields(model)) {
    const ops = data[f.name];
    if (!isObj(ops) || !isTenant(f.type) || f.type === "Shop") continue;
    const t = f.type;
    for (const id of [...ids(ops.connect), ...ids(ops.set)]) refs.push([t, id]);
    for (const c of list(ops.connectOrCreate)) {
      for (const id of ids(c.where)) refs.push([t, id, true]);
      if (isObj(c.create)) refs.push(...nestedReferencedIds(t, c.create));
    }
    for (const d of list(ops.create)) refs.push(...nestedReferencedIds(t, d));
    if (isObj(ops.createMany)) for (const d of list(ops.createMany.data)) refs.push(...nestedReferencedIds(t, d));
    for (const id of ids(ops.delete)) refs.push([t, id]);
    for (const u of list(ops.update)) {
      for (const id of ids(u.where)) refs.push([t, id]);
      refs.push(...nestedReferencedIds(t, isObj(u.data) ? u.data : u));
    }
    for (const u of list(ops.updateMany)) if (isObj(u.data)) refs.push(...nestedReferencedIds(t, u.data));
    for (const u of list(ops.upsert)) {
      for (const id of ids(u.where)) refs.push([t, id, true]);
      if (isObj(u.create)) refs.push(...nestedReferencedIds(t, u.create));
      if (isObj(u.update)) refs.push(...nestedReferencedIds(t, u.update));
    }
  }
  return refs;
}

/** Foreign keys on a write payload that point at tenant records: [targetModel, id]. */
export function referencedIds(model: string, data: Data): [string, string][] {
  const refs: [string, string][] = [];
  for (const f of relationFields(model)) {
    if (!isTenant(f.type) || f.type === "Shop") continue;
    // Runtime DMMF omits relationFromFields; every owning relation here follows the `<name>Id` convention.
    const fk = (MODELS.get(model) ?? []).some((x) => x.name === `${f.name}Id`) ? `${f.name}Id` : null;
    if (fk && typeof data[fk] === "string") refs.push([f.type, data[fk] as string]);
    const rel = data[f.name];
    if (isObj(rel) && isObj(rel.connect) && typeof rel.connect.id === "string") refs.push([f.type, rel.connect.id]);
  }
  return refs;
}

export class CrossShopError extends Error {
  constructor(model: string) {
    super(`${model} not found`);
    this.name = "CrossShopError";
  }
}

const READ_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
  "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany",
]);

type Counter = (model: string, id: string) => Promise<number>;

/** Rewrite query args for the current shop; throws CrossShopError for writes that reference another shop's rows. */
export async function scopeArgs(model: string, operation: string, args: Data, shopId: string, count: Counter, created: Set<string>, exists: Counter = count) {
  const filter = scopeFilter(model, shopId);
  if (!filter) return args;
  const next: Data = { ...args };
  const check = async (data: Data) => {
    for (const [target, id, mayCreate] of nestedReferencedIds(model, data)) {
      if (created.has(id)) continue;
      if ((await count(target, id)) > 0) continue;
      if (mayCreate && (await exists(target, id)) === 0) continue;
      throw new CrossShopError(target);
    }
  };
  if (READ_OPS.has(operation) || operation === "upsert") next.where = andWhere(next.where, filter);
  if (operation.startsWith("update") || operation === "upsert") {
    const key = operation === "upsert" ? "update" : "data";
    if (isObj(next[key])) {
      const { shopId: _drop, shop: _dropRel, ...rest } = next[key] as Data;
      void _drop; void _dropRel;
      next[key] = rest;
      await check(rest);
    }
  }
  if (operation === "create" || operation === "upsert") {
    const key = operation === "upsert" ? "create" : "data";
    await check(next[key] as Data);
    if (model !== "Shop") next[key] = stampCreate(model, next[key] as Data, shopId);
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const list = (Array.isArray(next.data) ? next.data : [next.data]) as Data[];
    for (const d of list) await check(d);
    next.data = list.map((d) => stampCreate(model, d, shopId));
  }
  return next;
}

export function createdIds(): Set<string> {
  return storage.getStore()?.created ?? new Set();
}

export function rememberCreated(result: unknown) {
  const store = storage.getStore();
  if (store && isObj(result) && typeof result.id === "string") store.created.add(result.id);
}

/** Settings rows are keyed per shop ("<shopId>:<name>"); unscoped code gets the bare name. */
export function shopSettingKey(name: string) {
  const shopId = currentShopId();
  return shopId ? `${shopId}:${name}` : name;
}

type ShopLookup = (model: string, id: string) => Promise<string | null>;

/**
 * Creates outside a shop context (public booking, webhooks, crons) inherit the shop of the
 * record they reference, e.g. a Payment takes its Invoice's shop; otherwise the fallback shop.
 */
export async function stampUnscopedCreate(model: string, data: Data, lookup: ShopLookup, fallback: () => Promise<string | null>) {
  if (!ROOT_MODELS.has(model) || data.shopId !== undefined || data.shop !== undefined) return data;
  let shopId: string | null = null;
  for (const [target, id] of referencedIds(model, data)) {
    if (!ROOT_MODELS.has(target)) continue;
    shopId = await lookup(target, id);
    if (shopId) break;
  }
  shopId ??= await fallback();
  return shopId ? stampCreate(model, data, shopId) : data;
}
