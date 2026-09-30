"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2 } from "lucide-react";

// Extracts a VIN (17 chars, no I/O/Q) from barcode text — tolerates a leading "I" prefix
// some Code-39 stickers emit.
function extractVin(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = cleaned.match(/[A-HJ-NPR-Z0-9]{17}/);
  return m ? m[0] : null;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
  static getSupportedFormats(): Promise<string[]>;
}

export function VinScanButton({ onVin, className }: { onVin: (vin: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let interval: number | undefined;
    const detector = new BarcodeDetector({ formats: ["code_39", "code_128", "qr_code", "data_matrix"] });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setScanning(true);
        interval = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            for (const c of codes) {
              const vin = extractVin(c.rawValue);
              if (vin) {
                stop();
                onVin(vin);
                setOpen(false);
                return;
              }
            }
          } catch { /* frame decode hiccup — keep scanning */ }
        }, 400);
      })
      .catch(() => setError("Camera unavailable — check camera permission."));

    function stop() {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (interval) clearInterval(interval);
    }
    return () => { cancelled = true; stop(); setScanning(false); };
  }, [open, onVin]);

  if (!supported) {
    return (
      <Button type="button" variant="outline" size="sm" className={className} disabled
        title="Barcode scanning requires Chrome or Android">
        <Camera className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)} title="Scan VIN barcode">
        <Camera className="h-4 w-4" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-black overflow-hidden relative">
            <video ref={videoRef} className="w-full aspect-[4/3] object-cover" muted playsInline />
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 border-2 border-blue-400 rounded pointer-events-none" />
            <button onClick={() => setOpen(false)} className="absolute top-2 right-2 p-2 text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-white text-sm mt-3 flex items-center gap-2">
            {scanning && !error ? <><Loader2 className="h-4 w-4 animate-spin" /> Point at the VIN barcode on the door sticker or dashboard</> : null}
          </p>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <p className="text-gray-400 text-xs mt-1">VIN plate text without a barcode must be typed in</p>
        </div>
      )}
    </>
  );
}
