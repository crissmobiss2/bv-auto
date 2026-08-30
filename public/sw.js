const CACHE_VERSION = "bvauto-v3";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;

// Pages and assets to precache on install
const PRECACHE_URLS = [
  "/offline.html",
  "/tech",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// API routes to cache for offline access (GET only)
const CACHEABLE_API = [
  "/api/jobs",
  "/api/customers",
  "/api/vehicles",
  "/api/parts",
  "/api/canned-services",
  "/api/labor-times",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — clean up old caches ───────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin GETs
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // ── API requests ────────────────────────────────────────────────────────────
  if (url.pathname.startsWith("/api/")) {
    const isCacheable = CACHEABLE_API.some((p) => url.pathname.startsWith(p));

    if (isCacheable) {
      // Network-first with cache fallback for important data
      e.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok) {
              caches.open(API_CACHE).then((c) => c.put(request, res.clone()));
            }
            return res;
          })
          .catch(() =>
            caches.match(request).then((cached) =>
              cached ||
              new Response(
                JSON.stringify({ error: "offline", cached: false }),
                { status: 503, headers: { "Content-Type": "application/json" } }
              )
            )
          )
      );
    } else {
      // Non-cacheable API: network only, return offline error
      e.respondWith(
        fetch(request).catch(() =>
          new Response(
            JSON.stringify({ error: "offline" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          )
        )
      );
    }
    return;
  }

  // ── Tech & Customer app pages: stale-while-revalidate ───────────────────────
  if (url.pathname.startsWith("/tech") || url.pathname.startsWith("/customer")) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached || caches.match("/offline.html"));
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── Static assets (icons, fonts, images): cache-first ───────────────────────
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf)$/)
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // ── Everything else: network with offline fallback ───────────────────────────
  // caches.match() resolves to a Promise (always truthy), so the old `|| offline`
  // never fired — resolve the cache lookup first, then fall back to the page.
  e.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((cached) => cached || caches.match("/offline.html"))
    )
  );
});

// ── Background Sync — replay queued mutations when back online ────────────────
self.addEventListener("sync", (e) => {
  if (e.tag === "sync-mutations") {
    e.waitUntil(replayMutations());
  }
});

async function replayMutations() {
  // Read queued mutations from IndexedDB (written by the app when offline)
  try {
    const db = await openDB();
    const mutations = await getAllMutations(db);
    for (const mutation of mutations) {
      try {
        await fetch(mutation.url, {
          method: mutation.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutation.body),
        });
        await deleteMutation(db, mutation.id);
      } catch {
        // Still offline — leave in queue
      }
    }
  } catch {
    // IndexedDB not available
  }
}

// ── IndexedDB helpers for offline mutation queue ──────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bvauto-offline", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutations", "readonly");
    const req = tx.objectStore("mutations").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutations", "readwrite");
    const req = tx.objectStore("mutations").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); }
  catch { data = { title: "B&V Auto", body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || "B&V Auto", {
      body: data.body,
      icon: data.icon  || "/icons/icon-192.png",
      badge: data.badge || "/icons/icon-192.png",
      tag: data.tag,
      requireInteraction: data.urgent || false,
      actions: data.actions || [],
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) return existing.focus().then((c) => c.navigate(url));
        return self.clients.openWindow(url);
      })
  );
});
