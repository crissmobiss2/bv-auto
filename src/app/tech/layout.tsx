"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Wrench, LogOut } from "lucide-react";
import Link from "next/link";

export default function TechLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white">Full View</Link>
          <button onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
