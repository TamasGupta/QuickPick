"use client";

import { useCallback, useEffect, useState } from "react";

export type PushRole = "seller" | "rider";

// Converts a base64url VAPID public key into the Uint8Array
// PushManager.subscribe() expects (the key is stored in
// NEXT_PUBLIC_VAPID_PUBLIC_KEY).
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Web Push enablement for a seller/rider context. Handles permission, creating
// the browser subscription, and persisting it server-side via
// /api/push/subscribe (the PWA's /sw.js carries the push listeners — see
// worker/index.js). Re-syncs an existing subscription on mount so a DB reset
// or reinstall that kept the same browser endpoint doesn't silently lose the
// registration.
export function usePushNotifications(role: PushRole) {
  const [supported] = useState(isSupported);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncToServer = useCallback(
    async (sub: PushSubscription) => {
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
          },
        }),
      });
      if (!res.ok) throw new Error("Could not save your notification subscription");
    },
    [role]
  );

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    setPermission(Notification.permission);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!alive) return;
        if (sub) {
          await syncToServer(sub);
          if (alive) setSubscribed(true);
        }
      } catch {
        // No SW registered yet (dev build) — nothing to sync, not an error.
      }
    })();

    return () => {
      alive = false;
    };
  }, [supported, syncToServer]);

  const request = useCallback(async () => {
    if (!supported) {
      setError("This browser doesn't support notifications.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const granted = (await Notification.requestPermission()) === "granted";
      setPermission(granted ? "granted" : "denied");
      if (!granted) return;

      // next-pwa registers /sw.js in production builds; if it hasn't appeared
      // yet (or a dev build skipped it), register it ourselves.
      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) throw new Error("Missing VAPID public key");
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await syncToServer(sub);
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable notifications");
      setPermission(Notification.permission);
    } finally {
      setBusy(false);
    }
  }, [supported, syncToServer]);

  const disable = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } catch {
      // Best-effort opt-out; local state still flips off.
    }
    setSubscribed(false);
  }, [supported]);

  return { supported, permission, subscribed, busy, error, request, disable };
}
