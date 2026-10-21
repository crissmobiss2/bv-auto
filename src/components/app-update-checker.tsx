"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";

interface AppVersionInfo {
  version?: string;
  androidVersionCode?: number;
  androidVersionName?: string;
  androidRequiresReinstallBelow?: number;
  downloadUrl?: string;
  playStoreUrl?: string;
  forceUpdate?: boolean;
}

interface AppUpdaterPlugin {
  downloadAndInstall(options: { url: string }): Promise<{ status: string }>;
  addListener(
    event: "downloadProgress",
    cb: (e: { percent: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

type Phase =
  | { kind: "idle" }
  | { kind: "downloading"; percent: number | null }
  | { kind: "installer" }
  | { kind: "browser" }
  | { kind: "error"; message: string };

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

async function openInSystemBrowser(url: string) {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch {
    window.location.href = url;
  }
}

export function AppUpdateChecker() {
  const [update, setUpdate] = useState<{
    version: string;
    url: string;
    force: boolean;
    reinstall: boolean;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const installed = await getInstalledBuild();
      if (installed === null) return;
      try {
        const { data } = await axios.get<AppVersionInfo>("/api/app-version", {
          headers: { "Cache-Control": "no-cache" },
        });
        const latestCode = data.androidVersionCode ?? 0;
        if (!cancelled && latestCode > installed) {
          const url = data.downloadUrl || data.playStoreUrl;
          if (url) {
            setUpdate({
              version: data.androidVersionName || data.version || "",
              url,
              force: !!data.forceUpdate,
              reinstall: installed < (data.androidRequiresReinstallBelow ?? 0),
            });
          }
        }
      } catch {
        // never block startup for an update check
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function startUpdate() {
    if (!update || busy.current) return;
    busy.current = true;
    try {
      const { Capacitor, registerPlugin } = await import("@capacitor/core");
      if (!update.reinstall && Capacitor.isPluginAvailable("AppUpdater")) {
        const updater = registerPlugin<AppUpdaterPlugin>("AppUpdater");
        setPhase({ kind: "downloading", percent: null });
        const sub = await updater.addListener("downloadProgress", ({ percent }) =>
          setPhase({ kind: "downloading", percent }),
        );
        try {
          await updater.downloadAndInstall({ url: update.url });
          setPhase({ kind: "installer" });
        } finally {
          await sub.remove();
        }
      } else {
        // Builds without the native updater: hand the APK to the browser's downloader.
        setPhase({ kind: "browser" });
        await openInSystemBrowser(update.url);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Update failed. Please try again.";
      setPhase({ kind: "error", message });
    } finally {
      busy.current = false;
    }
  }

  if (!update || dismissed) return null;

  const status =
    phase.kind === "downloading"
      ? `Downloading${phase.percent !== null ? ` ${phase.percent}%` : "…"}`
      : phase.kind === "installer"
        ? "Tap Install on the Android screen to finish."
        : phase.kind === "browser"
          ? update.reinstall
            ? "When the download finishes, uninstall the old B&V Auto app, then open app-release.apk and tap Install."
            : "When the download finishes, tap Open, then Install."
          : phase.kind === "error"
            ? phase.message
            : update.reinstall
              ? `Version ${update.version} needs a one-time reinstall.`
              : `Version ${update.version} is ready to install.`;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[60] p-4 ${update.force ? "bg-red-600" : "bg-blue-600"} text-white`}>
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            {update.force ? "Required Update Available" : "Update Available"}
          </p>
          <p className="text-xs opacity-90" role="status" aria-live="polite">{status}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={startUpdate}
            disabled={phase.kind === "downloading"}
            className="px-3 py-1.5 bg-white text-blue-700 text-xs font-bold rounded-lg disabled:opacity-60"
          >
            {phase.kind === "downloading" ? "Updating…" : phase.kind === "idle" ? "Update" : "Retry"}
          </button>
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
