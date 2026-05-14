"use client";

import { useEffect, useRef } from "react";

interface TechLocationTrackerProps {
  jobId?: string;
  active: boolean;
}

const POST_INTERVAL_MS = 30_000; // post every 30 seconds

export default function TechLocationTracker({ jobId, active }: TechLocationTrackerProps) {
  // Holds the latest GeolocationPosition so we can post on a timer without
  // hammering the API on every GPS update.
  const latestPosition = useRef<GeolocationPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    // Start watching GPS position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestPosition.current = position;
      },
      (err) => {
        // Non-fatal — technician may have denied permission
        console.warn("[TechLocationTracker] geolocation error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 }
    );

    // Post the latest position every 30 seconds
    const postLocation = async () => {
      const pos = latestPosition.current;
      if (!pos) return;

      try {
        await fetch("/api/tracking/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
            jobId: jobId ?? undefined,
          }),
        });
      } catch {
        // Non-fatal — will retry on next interval
      }
    };

    // Post immediately on activation, then on the interval
    postLocation();
    intervalRef.current = setInterval(postLocation, POST_INTERVAL_MS);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, jobId]);

  if (!active) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg opacity-80 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span>📍</span>
      <span>Sharing location</span>
    </div>
  );
}
