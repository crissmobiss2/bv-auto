"use client";

// Offline mutation queue — stores failed/queued API writes in localStorage
// and replays them when connectivity returns. Techs use this in dead zones.

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  data?: unknown;
  queuedAt: number;
}

const KEY = "bv-offline-queue";
const FLUSH_EVENT = "bv-offline-flushed";

export function queueSize(): number {
  if (typeof window === "undefined") return 0;
  try { return (JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedRequest[]).length; } catch { return 0; }
}

export function enqueue(req: Omit<QueuedRequest, "id" | "queuedAt">): void {
  const q = readQueue();
  q.push({ ...req, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function dequeue(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(readQueue().filter(r => r.id !== id)));
}

function readQueue(): QueuedRequest[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedRequest[]; } catch { return []; }
}

/** Returns true when the request was sent successfully. On network failure it is queued for replay. */
export async function sendOrQueue(url: string, method: string, data?: unknown): Promise<{ queued: boolean; ok: boolean; response?: Response }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    return { queued: false, ok: res.ok, response: res };
  } catch {
    enqueue({ url, method, data });
    return { queued: true, ok: false };
  }
}

/** Replay everything in the queue. Returns the number sent. */
export async function flushQueue(): Promise<number> {
  let sent = 0;
  for (const req of readQueue()) {
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: req.data !== undefined ? JSON.stringify(req.data) : undefined,
      });
      if (res.ok || res.status < 500) { // drop client errors too — they will never succeed
        dequeue(req.id);
        sent++;
      }
    } catch { break; } // still offline
  }
  if (sent) window.dispatchEvent(new CustomEvent(FLUSH_EVENT, { detail: sent }));
  return sent;
}

/** Axios-compatible write that queues on network failure (no response received). */
export async function apiWrite(url: string, method: "post" | "patch" | "put" | "delete", data?: unknown) {
  const axios = (await import("axios")).default;
  try {
    return await axios({ url, method, data });
  } catch (e) {
    if (typeof e === "object" && e !== null && "response" in e && (e as { response?: unknown }).response) throw e; // server answered — real error
    enqueue({ url, method: method.toUpperCase(), data });
    return { data: { queued: true } };
  }
}

let listenerInstalled = false;
export function installOfflineQueueListener(onFlush?: (sent: number) => void): void {
  if (listenerInstalled || typeof window === "undefined") return;
  listenerInstalled = true;
  window.addEventListener("online", () => { flushQueue().then(onFlush ?? (() => {})); });
}
