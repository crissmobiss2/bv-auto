"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Wrench, LogOut, ClipboardList, Stethoscope, CloudOff } from "lucide-react";
import Link from "next/link";
import { installOfflineQueueListener, queueSize } from "@/lib/offline-queue";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/tech", label: "My Jobs", icon: ClipboardList, match: (p: string) => p === "/tech" || p.startsWith("/tech/jobs") },
  { href: "/diagnostics?tab=scanner", label: "Scan", icon: Stethoscope, match: (p: string) => p.startsWith("/diagnostics") },
];

export default function TechLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [queued, setQueued] = useState(() => queueSize());
  const [justFlushed, setJustFlushed] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    installOfflineQueueListener(sent => {
      setQueued(0);
      setJustFlushed(sent > 0);
      setTimeout(() => setJustFlushed(false), 4000);
    });
    const t = setInterval(() => setQueued(queueSize()), 5000);
    return () => clearInterval(t);
  }, []);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Mobile header */}
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/tech" className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-blue-400" />
          <div>
            <p className="font-bold text-sm leading-tight">B&V Auto</p>
            <p className="text-xs text-gray-400 leading-tight">{session?.user?.name}</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {queued > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <CloudOff className="h-4 w-4" /> {queued} queued
            </span>
          )}
          {justFlushed && <span className="text-xs text-green-400">Synced</span>}
          <ThemeToggle className="text-gray-400" />
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white">Full View</Link>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="p-2 -m-1">
            <LogOut className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 max-w-lg mx-auto w-full">
        {children}
      </main>

      {/* Bottom navigation — thumb reach */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-gray-900 border-t border-gray-800 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto flex">
          {NAV_ITEMS.map(item => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center min-h-[64px] gap-1 text-xs font-medium transition-colors ${
                  active ? "text-blue-400" : "text-gray-400 active:text-white"
                }`}
              >
                <Icon className="h-6 w-6" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex-1 flex flex-col items-center justify-center min-h-[64px] gap-1 text-xs font-medium text-gray-400"
          >
            <LogOut className="h-6 w-6" />
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}
