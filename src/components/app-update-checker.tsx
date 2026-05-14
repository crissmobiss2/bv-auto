"use client";

import { useEffect, useState } from "react";
import axios from "axios";

function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

function getInstalledVersion(): string | null {
  if (typeof window === "undefined") return null;
  // Capacitor sets this on the native bridge
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      return cap.getPlatform() === "android" ? "0.1.0" : "0.1.0";
    }
  } catch { /* not in Capacitor */ }
  return null;
}

export function AppUpdateChecker() {
  const [update, setUpdate] = useState<{ version: string; url: string; force: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const installedVersion = getInstalledVersion();
    if (!installedVersion) return;

    axios.get("/api/app-version").then(({ data }) => {
      if (compareVersions(data.version, installedVersion) > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platform = (window as any).Capacitor?.getPlatform?.();
        const url = platform === "ios" ? data.appStoreUrl : data.playStoreUrl;
        setUpdate({ version: data.version, url, force: data.forceUpdate });
      }
    }).catch(() => {/* ignore */});
  }, []);

  if (!update || dismissed) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 ${update.force ? "bg-red-600" : "bg-blue-600"} text-white`}>
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">
            {update.force ? "Required Update Available" : "Update Available"}
          </p>
          <p className="text-xs opacity-90">Version {update.version} is ready to install.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a
            href={update.url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-white text-blue-700 text-xs font-bold rounded-lg"
          >
            Update
          </a>
          {!update.force && (
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-xs opacity-80 hover:opacity-100"
            >
              Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
