"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { notify } from "@/store/notify";

// Web Push's applicationServerKey wants a Uint8Array, but the VAPID public
// key is handed out as base64url text — this is the standard conversion.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Renders nothing once permission has already been decided (granted or
// denied) — a granted permission gets silently (re-)subscribed on mount
// with no UI, since there's nothing left to ask; a denied one can't be
// re-prompted by the page anyway, only from the browser's own site settings.
export function PushNotificationPrompt({ label = "Enable order notifications" }: { label?: string }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    if (Notification.permission === "granted") ensureSubscribed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureSubscribed() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // lib.dom's ArrayBufferView typing is stricter than what
          // PushManager actually accepts at runtime (a plain Uint8Array is
          // fine) — cast through BufferSource rather than loosen the
          // helper's return type.
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      console.error("[push] ensureSubscribed failed", (err as Error).message);
    }
  }

  async function enable() {
    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;
      await ensureSubscribed();
      notify.success("Notifications enabled");
    } catch (err) {
      notify.error((err as Error).message || "Couldn't enable notifications");
    } finally {
      setSubscribing(false);
    }
  }

  if (!supported || permission !== "default") return null;

  return (
    <button
      onClick={enable}
      disabled={subscribing}
      className="btn-outline flex w-full items-center justify-center gap-2 py-3"
    >
      <Bell className="h-4 w-4" />
      {subscribing ? "Enabling…" : label}
    </button>
  );
}
