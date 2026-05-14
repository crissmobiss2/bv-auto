"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import axios from "axios";

const DISMISSED_KEY = "push-notification-dismissed";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

export function PushNotificationSetup() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setShow(true);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setShow(false);
        return;
      }

      const { data } = await axios.get<{ publicKey: string }>("/api/push/vapid-key");
      const publicKey = data.publicKey;
      if (!publicKey) {
        console.warn("[push] VAPID public key not configured");
        setShow(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await axios.post("/api/push/subscribe", {
        token: JSON.stringify(subscription),
        platform: "web",
      });

      setShow(false);
    } catch (err) {
      console.error("[push] Failed to enable push notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="bg-blue-500 rounded-xl p-2 flex-shrink-0">
          <Bell className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Stay in the loop</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Enable push notifications to stay updated on jobs and payments
          </p>
          <Button
            size="sm"
            className="mt-2 bg-blue-500 hover:bg-blue-400 text-white h-7 text-xs"
            onClick={handleEnable}
            disabled={loading}
          >
            {loading ? "Enabling…" : "Enable"}
          </Button>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
