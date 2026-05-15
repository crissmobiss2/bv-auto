"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { openGlobalSearch } from "./global-search";

// Returns true if the event originated from an input/editable element
function inInput(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl combos handled by GlobalSearch directly
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inInput(e)) return;

      switch (e.key) {
        case "n": e.preventDefault(); router.push("/jobs/new"); break;
        case "i": e.preventDefault(); router.push("/invoices/new"); break;
        case "q": e.preventDefault(); router.push("/quotes/new"); break;
        case "s": case "/": e.preventDefault(); openGlobalSearch(); break;
        case "?": showShortcutsToast(); break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return null;
}

function showShortcutsToast() {
  // Simple visual hint — replace with a proper modal if desired
  const el = document.createElement("div");
  el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-4 text-sm font-mono space-y-1.5 border border-gray-700";
  el.style.minWidth = "260px";
  el.innerHTML = `
    <p class="font-sans font-semibold text-gray-200 pb-1 border-b border-gray-700 mb-2">Keyboard Shortcuts</p>
    <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
      <span class="text-gray-400">New Job</span><span>N</span>
      <span class="text-gray-400">New Invoice</span><span>I</span>
      <span class="text-gray-400">New Quote</span><span>Q</span>
      <span class="text-gray-400">Search</span><span>/ or S</span>
      <span class="text-gray-400">Command palette</span><span>⌘K</span>
      <span class="text-gray-400">This help</span><span>?</span>
    </div>
  `;
  document.body.appendChild(el);
  setTimeout(() => { if (document.body.contains(el)) document.body.removeChild(el); }, 4000);
}
