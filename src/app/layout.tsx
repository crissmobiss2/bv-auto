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
import { Toaster } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
});

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
    // iOS ignores SVG for the home-screen icon — use the real PNG.
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom for accessibility (was locked to maximumScale:1 / userScalable:false).
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} h-full antialiased bg-gray-50 dark:bg-gray-950`}>
        <Providers>
          {children}
          <GlobalSearch />
          <KeyboardShortcuts />
          <Toaster />
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
