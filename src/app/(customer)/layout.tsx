"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, FileText, Clock, Home, LogOut, Wrench, Phone, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/customer", label: "Home", icon: Home },
  { href: "/customer/vehicles", label: "My Vehicles", icon: Car },
  { href: "/customer/history", label: "Service History", icon: Clock },
  { href: "/customer/invoices", label: "Invoices", icon: FileText },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">B&V Auto</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="tel:+1" className="p-2 text-gray-500 hover:text-blue-600">
              <Phone className="h-4 w-4" />
            </a>
            <button className="p-2 text-gray-500 md:hidden" onClick={() => setMobileOpen(o => !o)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-2xl mx-auto w-full">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-48 border-r border-gray-200 bg-white py-6 px-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === href ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <div className="flex-1" />
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 px-3 mb-1 truncate">{session?.user?.name}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 w-full"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute top-14 left-0 right-0 bg-white border-b shadow-lg p-4 space-y-1"
              onClick={e => e.stopPropagation()}>
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm font-medium ${
                    pathname === href ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 px-3 py-3 rounded-lg text-sm text-red-600 w-full"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-4 pb-20 md:pb-4">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40">
        <div className="flex">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                pathname === href ? "text-blue-600" : "text-gray-400"
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              {label.split(" ")[0]}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
