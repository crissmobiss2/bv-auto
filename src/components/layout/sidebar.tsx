"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Car, FileText, Receipt, Package, BarChart3,
  Settings, Wrench, Bell, LogOut, ChevronLeft, ChevronRight, Shield,
  Smartphone, Boxes, CalendarCheck, Brain, BookOpen, CalendarDays,
  LayoutGrid, Building2, Megaphone, ShoppingCart, Timer, Star, MapPin,
  Calendar, TrendingUp, DollarSign, MessageSquare, ChevronDown, ChevronUp,
  Briefcase,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

type NavItem = { name: string; href: string; icon: React.ElementType; roles: string[] | null };
type NavSection = { id: string; label: string; icon: React.ElementType; items: NavItem[] };

const TOP_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: null },
];

const SECTIONS: NavSection[] = [
  {
    id: "work",
    label: "Work",
    icon: Briefcase,
    items: [
      { name: "Shop Board",       href: "/shop-board",       icon: LayoutGrid,   roles: null },
      { name: "Jobs",             href: "/jobs",             icon: Wrench,       roles: null },
      { name: "Schedule",         href: "/schedule",         icon: CalendarDays, roles: ["ADMIN","DISPATCHER","SERVICE_ADVISOR"] },
      { name: "Dispatch",         href: "/dispatch",         icon: Calendar,     roles: ["ADMIN","DISPATCHER","SERVICE_ADVISOR"] },
      { name: "Service Requests", href: "/service-requests", icon: CalendarCheck,roles: ["ADMIN","DISPATCHER","SERVICE_ADVISOR"] },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    items: [
      { name: "Customers", href: "/customers", icon: Users,     roles: null },
      { name: "Vehicles",  href: "/vehicles",  icon: Car,       roles: null },
      { name: "Fleet",     href: "/fleet",     icon: Building2, roles: ["ADMIN","DISPATCHER","ACCOUNTANT"] },
    ],
  },
  {
    id: "money",
    label: "Financials",
    icon: DollarSign,
    items: [
      { name: "Quotes",       href: "/quotes",       icon: FileText,   roles: ["ADMIN","DISPATCHER","ACCOUNTANT","SERVICE_ADVISOR"] },
      { name: "Invoices",     href: "/invoices",     icon: Receipt,    roles: ["ADMIN","DISPATCHER","ACCOUNTANT","SERVICE_ADVISOR"] },
      { name: "Pipeline",     href: "/pipeline",     icon: TrendingUp, roles: ["ADMIN","ACCOUNTANT"] },
      { name: "Reports",      href: "/reports",      icon: BarChart3,  roles: ["ADMIN","ACCOUNTANT"] },
      { name: "Payroll",      href: "/payroll",      icon: DollarSign, roles: ["ADMIN","ACCOUNTANT"] },
      { name: "Technicians",  href: "/technicians",  icon: Wrench,     roles: ["ADMIN","ACCOUNTANT","DISPATCHER"] },
    ],
  },
  {
    id: "parts",
    label: "Parts & Inventory",
    icon: Package,
    items: [
      { name: "Parts",        href: "/parts",        icon: Package,     roles: null },
      { name: "Parts Search", href: "/parts-search", icon: ShoppingCart,roles: null },
      { name: "Inventory",    href: "/inventory",    icon: Boxes,       roles: ["ADMIN","DISPATCHER","PARTS_COORDINATOR"] },
      { name: "Price Book",   href: "/price-book",   icon: BookOpen,    roles: ["ADMIN","DISPATCHER"] },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Brain,
    items: [
      { name: "Diagnostics", href: "/diagnostics", icon: Brain,    roles: null },
      { name: "Specs",       href: "/specs",        icon: BookOpen, roles: null },
      { name: "Labor Times", href: "/labor-times", icon: Timer,    roles: ["ADMIN","DISPATCHER","TECHNICIAN"] },
      { name: "Warranty",    href: "/warranty",    icon: Shield,   roles: ["ADMIN","DISPATCHER"] },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    icon: Megaphone,
    items: [
      { name: "Marketing", href: "/marketing", icon: Megaphone,     roles: ["ADMIN","DISPATCHER"] },
      { name: "Sequences", href: "/sequences", icon: MessageSquare, roles: ["ADMIN","DISPATCHER"] },
      { name: "Reviews",   href: "/reviews",   icon: Star,          roles: ["ADMIN","DISPATCHER"] },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Settings,
    items: [
      { name: "Shops",         href: "/shops",         icon: MapPin,    roles: ["ADMIN"] },
      { name: "Notifications", href: "/notifications", icon: Bell,      roles: null },
      { name: "Tech View",     href: "/tech",          icon: Smartphone,roles: null },
      { name: "Audit Log",     href: "/audit",         icon: Shield,    roles: ["ADMIN"] },
      { name: "Settings",      href: "/settings",      icon: Settings,  roles: null },
    ],
  },
];

const STORAGE_KEY = "sidebar_open_sections";
const DEFAULT_OPEN = new Set(["work", "customers"]);

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(DEFAULT_OPEN);

  const role = session?.user?.role || "";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOpenSections(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    for (const section of SECTIONS) {
      if (section.items.some(item => pathname.startsWith(item.href))) {
        setOpenSections(prev => new Set([...prev, section.id]));
        break;
      }
    }
  }, [pathname]);

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function canSee(roles: string[] | null) {
    return !roles || roles.includes(role);
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  const userName = session?.user?.name || "";
  const initials = userName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside className={cn(
      "flex flex-col h-screen transition-all duration-200 flex-shrink-0",
      "bg-[#0f1629] text-white border-r border-white/[0.06]",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Brand header */}
      <div className={cn(
        "flex items-center border-b border-white/[0.06] flex-shrink-0",
        collapsed ? "justify-center px-0 py-4" : "justify-between px-4 py-4"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Premium logo mark */}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/40">
              <Wrench className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-tight tracking-tight">B&V Auto</p>
              <p className="text-[10px] text-white/35 leading-tight font-medium tracking-wide uppercase">Business OS</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Wrench className="h-3.5 w-3.5 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all flex-shrink-0",
            collapsed && "hidden"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Collapsed expand button */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0 scrollbar-thin">

        {/* Dashboard */}
        {TOP_ITEMS.map(item => (
          <div key={item.href} className="px-2">
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all",
                isActive(item.href)
                  ? "bg-blue-600/90 text-white shadow-sm shadow-blue-900/30"
                  : "text-white/55 hover:text-white/90 hover:bg-white/[0.06]",
                collapsed && "justify-center px-0 py-2.5"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="leading-none">{item.name}</span>}
            </Link>
          </div>
        ))}

        {/* Sections */}
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(i => canSee(i.roles));
          if (visibleItems.length === 0) return null;

          const isOpen = openSections.has(section.id);
          const sectionActive = visibleItems.some(i => isActive(i.href));

          if (collapsed) {
            return (
              <div key={section.id} className="px-2 pt-1">
                <div className="h-px bg-white/[0.05] mx-1 mb-1" />
                {visibleItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      "flex items-center justify-center p-2.5 rounded-lg transition-all mb-0.5",
                      isActive(item.href)
                        ? "bg-blue-600/90 text-white shadow-sm shadow-blue-900/30"
                        : "text-white/40 hover:text-white/80 hover:bg-white/[0.06]"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            );
          }

          return (
            <div key={section.id} className="px-2 pt-2">
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-widest transition-all",
                  sectionActive
                    ? "text-blue-400/90"
                    : "text-white/25 hover:text-white/50"
                )}
              >
                <span>{section.label}</span>
                {isOpen
                  ? <ChevronUp className="h-2.5 w-2.5 opacity-60" />
                  : <ChevronDown className="h-2.5 w-2.5 opacity-60" />}
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all",
                        isActive(item.href)
                          ? "bg-blue-600/90 text-white font-medium shadow-sm shadow-blue-900/30"
                          : "text-white/50 hover:text-white/90 hover:bg-white/[0.06]"
                      )}
                    >
                      <item.icon className={cn(
                        "h-3.5 w-3.5 flex-shrink-0",
                        isActive(item.href) ? "opacity-100" : "opacity-70"
                      )} />
                      <span className="leading-none">{item.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-2 space-y-0.5">
        {!collapsed && session?.user && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-white text-[11px] font-bold leading-none select-none">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white/90 truncate leading-tight">{userName}</p>
              <p className="text-[10px] text-white/35 leading-tight capitalize">{role.toLowerCase().replace(/_/g, " ")}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-all",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
          {!collapsed && <span className="text-xs">Sign Out</span>}
        </button>

        {/* Keyboard shortcut hint */}
        {!collapsed && (
          <div className="px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-white/20">Press</span>
            <kbd className="text-[9px] text-white/25 font-mono bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.07]">? for shortcuts</kbd>
          </div>
        )}
      </div>
    </aside>
  );
}
