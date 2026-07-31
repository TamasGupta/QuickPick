"use client";

import { useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { usePushNotifications, type PushRole } from "@/hooks/usePushNotifications";

// Dismissible Web Push opt-in banner for sellers (SellerNav) and riders
// (RiderDashboard). Layered on top of the existing Realtime badges: Realtime
// keeps the UI live while the app is open, push covers the closed app.
export function PushNotificationPrompt({ role }: { role: PushRole }) {
  const { supported, permission, subscribed, busy, error, request, disable } =
    usePushNotifications(role);
  const [dismissed, setDismissed] = useState(false);

  if (!supported || dismissed || permission === "denied") return null;

  if (subscribed) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-brand-700">
          <BellRing className="h-4 w-4" /> Notifications are on
        </span>
        <button onClick={disable} className="text-xs font-semibold text-brand-600 hover:underline">
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-ink-soft">
        <Bell className="h-4 w-4 shrink-0 text-accent-500" />
        <span className="text-xs sm:text-sm">
          {role === "seller"
            ? "Get a ping when a new order comes in, even with the app closed."
            : "Get a ping when a new delivery is ready, even with the app closed."}
        </span>
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {error && <span className="hidden max-w-[12rem] text-xs text-red-600 sm:inline">{error}</span>}
        <button onClick={request} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
          {busy ? "Enabling…" : "Enable notifications"}
        </button>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-ink-faint hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
