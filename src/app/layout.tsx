import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { AppUpdateChecker } from "@/components/app-update-checker";
import { PushNotificationSetup } from "@/components/push-notification-setup";
import { GlobalSearch } from "@/components/global-search";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "B&V Mobile Auto — Business Operating System",
  description: "CRM, quoting, invoicing, parts, and dispatch for mobile auto repair",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BV Auto",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Force light mode — app UI is not dark-mode compatible */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.remove('dark');localStorage.removeItem('theme');`,
          }}
        />
      </head>
      <body className={`${inter.className} h-full antialiased bg-gray-50`}>
        <Providers>
          {children}
          <GlobalSearch />
          <KeyboardShortcuts />
        </Providers>
        <PwaInstallPrompt />
        <AppUpdateChecker />
        <PushNotificationSetup />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
