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
      { name: "Quotes",   href: "/quotes",   icon: FileText,   roles: ["ADMIN","DISPATCHER","ACCOUNTANT","SERVICE_ADVISOR"] },
      { name: "Invoices", href: "/invoices", icon: Receipt,    roles: ["ADMIN","DISPATCHER","ACCOUNTANT","SERVICE_ADVISOR"] },
      { name: "Pipeline", href: "/pipeline", icon: TrendingUp, roles: ["ADMIN","ACCOUNTANT"] },
      { name: "Reports",  href: "/reports",  icon: BarChart3,  roles: ["ADMIN","ACCOUNTANT"] },
      { name: "Payroll",  href: "/payroll",  icon: DollarSign, roles: ["ADMIN","ACCOUNTANT"] },
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
      { name: "Specs",        href: "/specs",       icon: BookOpen, roles: null },
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

  // Persist section open state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOpenSections(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  // Auto-open the section containing the active route
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

  return (
    <aside className={cn(
      "flex flex-col bg-gray-900 text-white transition-all duration-200 h-screen",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-gray-700/60 flex-shrink-0">
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">B&V Auto</p>
            <p className="text-[10px] text-gray-400 leading-tight">Mobile Repair OS</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">

        {/* Top-level items (Dashboard) */}
        {TOP_ITEMS.map(item => (
          <div key={item.href} className="px-2">
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700/70 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          </div>
        ))}

        {/* Grouped sections */}
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(i => canSee(i.roles));
          if (visibleItems.length === 0) return null;

          const isOpen = openSections.has(section.id);
          const sectionActive = visibleItems.some(i => isActive(i.href));

          // Collapsed mode: show icons only, no headers
          if (collapsed) {
            return (
              <div key={section.id} className="px-2 pt-1">
                {visibleItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-md transition-colors mb-0.5",
                      isActive(item.href)
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-700 hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            );
          }

          return (
            <div key={section.id} className="px-2 pt-1">
              {/* Section header / toggle */}
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors",
                  sectionActive
                    ? "text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <section.icon className="h-3.5 w-3.5" />
                  <span>{section.label}</span>
                </div>
                {isOpen
                  ? <ChevronUp className="h-3 w-3 opacity-60" />
                  : <ChevronDown className="h-3 w-3 opacity-60" />}
              </button>

              {/* Items */}
              {isOpen && (
                <div className="mt-0.5 space-y-0.5 pl-1">
                  {visibleItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-blue-600 text-white font-medium"
                          : "text-gray-300 hover:bg-gray-700/70 hover:text-white"
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0 opacity-80" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="flex-shrink-0 border-t border-gray-700/60 px-2 py-3 space-y-1">
        {!collapsed && session?.user && (
          <div className="px-2.5 pb-1">
            <p className="text-xs font-medium text-white truncate">{session.user.name}</p>
            <p className="text-[10px] text-gray-400 truncate capitalize">{role.toLowerCase().replace("_", " ")}</p>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-gray-400 hover:bg-gray-700/70 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
