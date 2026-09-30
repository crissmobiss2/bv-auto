"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface AppVersionInfo {
  version?: string;
  androidVersionCode?: number;
  downloadUrl?: string;
  playStoreUrl?: string;
  appStoreUrl?: string;
  forceUpdate?: boolean;
}

async function getInstalledBuild(): Promise<number | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return null;
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return parseInt(info.build || "0", 10) || 0;
  } catch {
    return null;
  }
}

export function AppUpdateChecker() {
  const [update, setUpdate] = useState<{ version: string; url: string; force: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const installed = await getInstalledBuild();
      if (installed === null) return;
      try {
        const { data } = await axios.get<AppVersionInfo>("/api/app-version");
        const latestCode = data.androidVersionCode ?? 0;
        if (!cancelled && latestCode > installed) {
          const url = data.downloadUrl || data.playStoreUrl;
          if (url) {
            setUpdate({ version: data.version || "", url, force: !!data.forceUpdate });
          }
        }
      } catch {
        // never block startup for an update check
      }
    })();
    return () => { cancelled = true; };
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
