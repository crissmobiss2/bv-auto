"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import {
  Wrench, Users, Car, Receipt, FileText, Brain, Database, Calendar,
  BarChart3, Settings, Plus, Search, Loader2, ArrowRight,
} from "lucide-react";

interface SearchResult {
  type: string; id: string; label: string; sub: string; href: string;
}

interface SearchResponse { results: SearchResult[] }

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; group: string }> = {
  job:      { icon: <Wrench className="h-4 w-4" />,  color: "text-blue-600",  group: "Jobs" },
  customer: { icon: <Users className="h-4 w-4" />,   color: "text-green-600", group: "Customers" },
  vehicle:  { icon: <Car className="h-4 w-4" />,     color: "text-purple-600",group: "Vehicles" },
  invoice:  { icon: <Receipt className="h-4 w-4" />, color: "text-orange-600",group: "Invoices" },
};

const QUICK_ACTIONS = [
  { label: "New Job",        href: "/jobs/new",       icon: <Wrench className="h-4 w-4 text-blue-600" />,  shortcut: "N" },
  { label: "New Customer",   href: "/customers/new",  icon: <Users className="h-4 w-4 text-green-600" />,  shortcut: "" },
  { label: "New Invoice",    href: "/invoices/new",   icon: <Receipt className="h-4 w-4 text-orange-600" />,shortcut: "I" },
  { label: "New Quote",      href: "/quotes/new",     icon: <FileText className="h-4 w-4 text-teal-600" />, shortcut: "Q" },
  { label: "Diagnostics",    href: "/diagnostics",    icon: <Brain className="h-4 w-4 text-indigo-600" />,  shortcut: "" },
  { label: "Vehicle Specs",  href: "/specs",          icon: <Database className="h-4 w-4 text-gray-600" />, shortcut: "" },
  { label: "Schedule",       href: "/schedule",       icon: <Calendar className="h-4 w-4 text-pink-600" />, shortcut: "" },
  { label: "Reports",        href: "/reports",        icon: <BarChart3 className="h-4 w-4 text-cyan-600" />,shortcut: "" },
  { label: "Settings",       href: "/settings",       icon: <Settings className="h-4 w-4 text-gray-500" />, shortcut: "" },
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

  // Register global opener
  useEffect(() => {
    globalOpenSearch = () => setOpen(true);
    return () => { globalOpenSearch = null; };
  }, []);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: SearchResponse = await res.json();
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

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    (grouped[r.type] ??= []).push(r);
  }

  const showActions = query.length < 2;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl mx-4 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <Command className="rounded-xl" shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            {loading
              ? <Loader2 className="mr-2 h-4 w-4 shrink-0 text-gray-400 animate-spin" />
              : <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />}
            <CommandInput
              placeholder="Search jobs, customers, vehicles, invoices…"
              value={query}
              onValueChange={setQuery}
              className="h-12 text-base"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-gray-50 px-1.5 text-[10px] font-mono text-gray-400 ml-2 flex-shrink-0">
              ESC
            </kbd>
          </div>

          <CommandList className="max-h-[60vh] overflow-y-auto">
            {showActions ? (
              <>
                <CommandGroup heading="Quick Actions">
                  {QUICK_ACTIONS.map(a => (
                    <CommandItem key={a.href} onSelect={() => navigate(a.href)} className="flex items-center gap-2.5 py-2.5 cursor-pointer">
                      <span className="flex-shrink-0">{a.icon}</span>
                      <span className="flex-1 text-sm">{a.label}</span>
                      {a.label.startsWith("New") && <Plus className="h-3 w-3 text-gray-300" />}
                      {a.shortcut && (
                        <kbd className="h-5 items-center rounded border bg-gray-50 px-1.5 text-[10px] font-mono text-gray-400 hidden sm:flex">
                          {a.shortcut}
                        </kbd>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <div className="px-3 py-2.5">
                  <p className="text-xs text-gray-400">Type to search across all records</p>
                </div>
              </>
            ) : (
              <>
                {results.length === 0 && !loading && (
                  <CommandEmpty>
                    <div className="py-8 text-center text-sm text-gray-400">
                      No results for &ldquo;{query}&rdquo;
                    </div>
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
                          onSelect={() => navigate(item.href)}
                          className="flex items-center gap-2.5 py-2.5 cursor-pointer group"
                        >
                          <span className={`flex-shrink-0 ${config.color}`}>{config.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                            {item.sub && <p className="text-xs text-gray-400 truncate">{item.sub}</p>}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-300 opacity-0 group-aria-selected:opacity-100 transition-opacity flex-shrink-0" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>

          {/* Footer */}
          <div className="border-t bg-gray-50/80 px-3 py-2 flex items-center justify-between">
            <div className="flex gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border bg-white px-1 text-[10px] font-mono">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border bg-white px-1 text-[10px] font-mono">↵</kbd> open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border bg-white px-1 text-[10px] font-mono">ESC</kbd> close
              </span>
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">
              <kbd className="inline-flex h-4 items-center rounded border bg-white px-1 text-[10px] font-mono">⌘K</kbd> to toggle
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
