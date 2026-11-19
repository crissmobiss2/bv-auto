"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

export function InvoicePdfButton({ href }: { href: string }) {
  const [opening, setOpening] = useState(false);

  async function openPdf() {
    const absolute = new URL(href, window.location.origin).toString();
    const native = !!(window as CapacitorWindow).Capacitor?.isNativePlatform?.();
    if (!native) {
      const popup = window.open(absolute, "_blank", "noopener,noreferrer");
      if (!popup) window.location.href = absolute;
      return;
    }

    setOpening(true);
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: absolute });
    } catch {
      // Last resort: keep the PDF in the app webview if the system browser fails.
      window.location.href = absolute;
    } finally {
      setOpening(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={openPdf} disabled={opening}>
      {opening ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
      PDF
    </Button>
  );
}
