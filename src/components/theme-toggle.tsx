"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/[0.07] rounded-xl h-9 w-[180px]" />
  );

  return (
    <div className="flex items-center gap-0.5 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl border border-gray-200 dark:border-white/[0.08]">
      {[
        { value: "light",  icon: Sun,     label: "Light"  },
        { value: "system", icon: Monitor, label: "System" },
        { value: "dark",   icon: Moon,    label: "Dark"   },
      ].map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            theme === value
              ? "bg-white dark:bg-white/[0.12] shadow-sm text-gray-900 dark:text-white"
              : "text-gray-500 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggleCompact() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-all"
    >
      {isDark
        ? <Sun className="h-4 w-4" />
        : <Moon className="h-4 w-4" />
      }
    </button>
  );
}
