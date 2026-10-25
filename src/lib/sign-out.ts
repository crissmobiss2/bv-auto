"use client";

import { signOut } from "next-auth/react";

/**
 * Sign out and remove all Cache Storage entries. Cached pages and API payloads
 * are shared by every account that uses this device, so a shared shop tablet
 * must not leave one user's data available to the next.
 */
export async function signOutAndClear() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache Storage may be unavailable in private mode; sign-out still works.
  }

  await signOut({ callbackUrl: `${window.location.origin}/login` });
}
