"use client";

import { Search, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { openGlobalSearch } from "@/components/global-search";
import { ThemeToggleCompact } from "@/components/theme-toggle";

interface TopbarProps {
  onMenuToggle?: () => void;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:              "Admin",
  DISPATCHER:         "Dispatcher",
  TECHNICIAN:         "Technician",
  PARTS_COORDINATOR:  "Parts",
  ACCOUNTANT:         "Accountant",
  SERVICE_ADVISOR:    "Service Advisor",
  CUSTOMER:           "Customer",
};

const AVATAR_COLORS = [
  "from-blue-500 to-blue-700",
  "from-violet-500 to-violet-700",
  "from-emerald-500 to-emerald-700",
  "from-orange-400 to-orange-600",
  "from-rose-500 to-rose-700",
  "from-cyan-500 to-cyan-700",
];

function avatarGradient(name?: string | null) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { data: session } = useSession();

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => axios.get("/api/notifications").then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const urgentCount = notifData?.counts
    ? (notifData.counts.overdue || 0) + (notifData.counts.unassigned || 0) + (notifData.counts.partsToOrder || 0)
    : 0;

  const userName = session?.user?.name;
  const userRole = session?.user?.role as string | undefined;
  const gradient = avatarGradient(userName);

  return (
    <header className="h-14 border-b bg-white/90 dark:bg-[#0f1629]/90 backdrop-blur-md border-gray-200/80 dark:border-white/[0.06] flex items-center justify-between px-3 md:px-5 gap-3 flex-shrink-0 sticky top-0 z-40">

      {/* Left */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost" size="icon"
          className="md:hidden h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-xs text-gray-400 dark:text-white/30 font-medium">B&V Auto</span>
          <span className="text-gray-200 dark:text-white/15">/</span>
          <span className="text-xs text-gray-700 dark:text-white/70 font-semibold">
            {ROLE_LABELS[userRole || ""] || "Dashboard"}
          </span>
        </div>
      </div>

      {/* Center: search */}
      <button
        onClick={openGlobalSearch}
        className="hidden md:flex flex-1 max-w-md items-center gap-2 h-8 px-3 rounded-lg bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.12] transition-all cursor-pointer"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-[13px]">Search customers, jobs, vehicles…</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-1.5 text-[10px] font-mono text-gray-400 dark:text-white/30 flex-shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* Right */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button
          variant="ghost" size="icon"
          className="md:hidden h-8 w-8 text-gray-500 dark:text-white/40"
          onClick={openGlobalSearch}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>

        <ThemeToggleCompact />

        <Link href="/notifications">
          <Button
            variant="ghost" size="icon"
            className="relative h-8 w-8 text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.07]"
            aria-label={`Notifications${urgentCount > 0 ? ` (${urgentCount})` : ""}`}
          >
            <Bell className="h-4 w-4" />
            {urgentCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                {urgentCount > 9 ? "9+" : urgentCount}
              </span>
            )}
          </Button>
        </Link>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-2.5 ml-1 border-l border-gray-100 dark:border-white/[0.07]">
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
            <span className="text-white text-[11px] font-bold leading-none select-none">
              {getInitials(userName)}
            </span>
          </div>
          <div className="hidden sm:block min-w-0 pr-1">
            <p className="text-xs font-semibold text-gray-800 dark:text-white/85 leading-tight truncate max-w-[96px]">
              {userName}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-white/35 leading-tight">
              {ROLE_LABELS[userRole || ""] || ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
