"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import {
  Wrench, Users, Car, Receipt, FileText, Brain, Database, Calendar,
  BarChart3, Settings, Plus, Loader2, ArrowRight,
} from "lucide-react";

interface SearchResult {
  type: string; id: string; label: string; sub: string; href: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; group: string }> = {
  job:      { icon: <Wrench className="h-4 w-4" />,  color: "text-blue-500",   group: "Jobs" },
  customer: { icon: <Users className="h-4 w-4" />,   color: "text-emerald-500",group: "Customers" },
  vehicle:  { icon: <Car className="h-4 w-4" />,     color: "text-purple-500", group: "Vehicles" },
  invoice:  { icon: <Receipt className="h-4 w-4" />, color: "text-orange-500", group: "Invoices" },
};

const QUICK_ACTIONS = [
  { label: "New Job",       href: "/jobs/new",      icon: <Wrench className="h-4 w-4 text-blue-500" />,   shortcut: "N" },
  { label: "New Customer",  href: "/customers/new", icon: <Users className="h-4 w-4 text-emerald-500" />, shortcut: "" },
  { label: "New Invoice",   href: "/invoices/new",  icon: <Receipt className="h-4 w-4 text-orange-500" />,shortcut: "I" },
  { label: "New Quote",     href: "/quotes/new",    icon: <FileText className="h-4 w-4 text-teal-500" />, shortcut: "Q" },
  { label: "Diagnostics",   href: "/diagnostics",   icon: <Brain className="h-4 w-4 text-indigo-500" />,  shortcut: "" },
  { label: "Vehicle Specs", href: "/specs",         icon: <Database className="h-4 w-4 text-gray-500" />, shortcut: "" },
  { label: "Schedule",      href: "/schedule",      icon: <Calendar className="h-4 w-4 text-pink-500" />, shortcut: "" },
  { label: "Reports",       href: "/reports",       icon: <BarChart3 className="h-4 w-4 text-cyan-500" />,shortcut: "" },
  { label: "Settings",      href: "/settings",      icon: <Settings className="h-4 w-4 text-gray-400" />, shortcut: "" },
];

let globalOpenSearch: (() => void) | null = null;
export function openGlobalSearch() { globalOpenSearch?.(); }

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    globalOpenSearch = () => setOpen(true);
    return () => { globalOpenSearch = null; };
  }, []);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }, [router]);

  if (!open) return null;

  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    (grouped[r.type] ??= []).push(r);
  }
  const showActions = query.length < 2;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[8vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 bg-white dark:bg-[#111827] rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 border border-gray-200 dark:border-white/[0.08] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          {/* Custom input row — replaces CommandInput wrapper to allow loading icon */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-100 dark:border-white/[0.07] h-[52px]">
            {loading
              ? <Loader2 className="h-4 w-4 shrink-0 text-gray-400 dark:text-white/30 animate-spin" />
              : <span className="h-4 w-4 shrink-0 text-gray-400 dark:text-white/30">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </span>
            }
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search jobs, customers, vehicles, invoices…"
              className="flex-1 h-full bg-transparent text-[15px] text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none border-none"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.05] px-1.5 text-[10px] font-mono text-gray-400 dark:text-white/25 flex-shrink-0">
              ESC
            </kbd>
          </div>

          <CommandList className="max-h-[60vh] overflow-y-auto">
            {showActions ? (
              <>
                <CommandGroup heading="Quick Actions">
                  {QUICK_ACTIONS.map(a => (
                    <CommandItem
                      key={a.href}
                      value={a.label}
                      onSelect={() => navigate(a.href)}
                      className="flex items-center gap-3 py-2.5 px-3 cursor-pointer"
                    >
                      <span className="flex-shrink-0">{a.icon}</span>
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-white/80">{a.label}</span>
                      {a.label.startsWith("New") && <Plus className="h-3 w-3 text-gray-300 dark:text-white/20" />}
                      {a.shortcut && (
                        <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.05] px-1.5 text-[10px] font-mono text-gray-400 dark:text-white/25">
                          {a.shortcut}
                        </kbd>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <div className="px-4 py-2.5">
                  <p className="text-xs text-gray-400 dark:text-white/25">Type 2+ characters to search all records</p>
                </div>
              </>
            ) : (
              <>
                {results.length === 0 && !loading && (
                  <CommandEmpty>
                    No results for &ldquo;{query}&rdquo;
                  </CommandEmpty>
                )}
                {Object.entries(grouped).map(([type, items]) => {
                  const config = TYPE_CONFIG[type];
                  if (!config || items.length === 0) return null;
                  return (
                    <CommandGroup key={type} heading={config.group}>
                      {items.map(item => (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          onSelect={() => navigate(item.href)}
                          className="flex items-center gap-3 py-2.5 cursor-pointer group"
                        >
                          <span className={`flex-shrink-0 ${config.color}`}>{config.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white/90 truncate">{item.label}</p>
                            {item.sub && <p className="text-xs text-gray-400 dark:text-white/30 truncate">{item.sub}</p>}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-300 dark:text-white/20 opacity-0 group-aria-selected:opacity-100 transition-opacity flex-shrink-0" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] px-4 py-2.5 flex items-center justify-between">
            <div className="flex gap-3 text-xs text-gray-400 dark:text-white/25">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-1 text-[10px] font-mono">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-1 text-[10px] font-mono">↵</kbd> open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-1 text-[10px] font-mono">ESC</kbd> close
              </span>
            </div>
            <span className="text-xs text-gray-400 dark:text-white/25 hidden sm:block">
              <kbd className="inline-flex h-4 items-center rounded border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-1 text-[10px] font-mono">⌘K</kbd> to toggle
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
