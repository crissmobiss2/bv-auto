"use client";

import { Search, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { openGlobalSearch } from "@/components/global-search";

interface TopbarProps {
  onMenuToggle?: () => void;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  DISPATCHER: "Dispatcher",
  TECHNICIAN: "Technician",
  PARTS_COORDINATOR: "Parts",
  ACCOUNTANT: "Accountant",
  SERVICE_ADVISOR: "Service Advisor",
  CUSTOMER: "Customer",
};

const AVATAR_COLORS = [
  "bg-blue-600", "bg-violet-600", "bg-emerald-600",
  "bg-orange-500", "bg-rose-600", "bg-cyan-600",
];

function avatarColor(name?: string | null) {
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

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-3 md:px-5 gap-3 flex-shrink-0">

      {/* Left: hamburger (mobile) + breadcrumb (desktop) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="ghost" size="icon"
          className="md:hidden h-8 w-8 text-gray-500 hover:text-gray-900"
          onClick={onMenuToggle} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">B&V Auto</span>
          <span className="text-gray-200">/</span>
          <span className="text-xs text-gray-600 font-semibold">
            {ROLE_LABELS[userRole || ""] || "Dashboard"}
          </span>
        </div>
      </div>

      {/* Center: Cmd+K search trigger (desktop) */}
      <button
        onClick={openGlobalSearch}
        className="hidden md:flex flex-1 max-w-md items-center gap-2 h-8 px-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-400 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">Search customers, jobs, vehicles…</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 text-[10px] font-mono text-gray-400 flex-shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* Right: search icon (mobile) + bell + avatar */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-gray-500"
          onClick={openGlobalSearch} aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>

        <Link href="/notifications">
          <Button variant="ghost" size="icon"
            className="relative h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            aria-label={`Notifications${urgentCount > 0 ? ` (${urgentCount} urgent)` : ""}`}>
            <Bell className="h-4 w-4" />
            {urgentCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                {urgentCount > 9 ? "9+" : urgentCount}
              </span>
            )}
          </Button>
        </Link>

        {/* Divider + user avatar */}
        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-100">
          <div className={`w-7 h-7 rounded-full ${avatarColor(userName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <span className="text-white text-[11px] font-bold leading-none select-none">
              {getInitials(userName)}
            </span>
          </div>
          <div className="hidden sm:block min-w-0 pr-1">
            <p className="text-xs font-semibold text-gray-800 leading-tight truncate max-w-[96px]">
              {userName}
            </p>
            <p className="text-[10px] text-gray-400 leading-tight">
              {ROLE_LABELS[userRole || ""] || ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
