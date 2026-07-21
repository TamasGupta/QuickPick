"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mounted (renders nothing) alongside a Server Component that reads from
// `orders` — periodically calls router.refresh() so the page's server-fetched
// data (status badges, new orders, rider assignment, etc.) updates without a
// manual reload. Polling rather than a Supabase Realtime subscription: this
// project's `orders` table isn't tracked as a member of the `supabase_realtime`
// publication in any migration, so postgres_changes delivery can't be relied
// on here — same tradeoff the existing useNotifications/rider polls already
// make elsewhere in the app.
export function OrdersAutoRefresh({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
