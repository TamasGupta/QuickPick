"use client";

import { useEffect, useState } from "react";

export interface Notifications {
  buyerActive: number;
  sellerNew: number;
  riderAvailable: number;
}

const EMPTY: Notifications = { buyerActive: 0, sellerNew: 0, riderAvailable: 0 };

// Polls badge counts for the current user. Lightweight; refreshes periodically.
export function useNotifications(intervalMs = 20000): Notifications {
  const [counts, setCounts] = useState<Notifications>(EMPTY);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Notifications;
        if (alive) setCounts(json);
      } catch {
        /* ignore transient failures */
      }
    }
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return counts;
}
