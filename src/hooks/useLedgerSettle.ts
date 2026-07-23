"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/store/notify";
import type { LedgerEntry } from "@/lib/types";

// Shared settle mutation for any ledger view (day-grouped, rider-grouped,
// flat list). RLS still enforces who's actually allowed to settle a given
// row — this just issues the update and reflects the result in local state.
export function useLedgerSettle<T extends LedgerEntry>(initial: T[]) {
  const [entries, setEntries] = useState<T[]>(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function settle(ids: string[], busyKeyLabel: string) {
    if (ids.length === 0) return;
    setBusyKey(busyKeyLabel);
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("ledger_entries")
      .update({ settled: true, settled_at: nowIso })
      .in("id", ids);
    setBusyKey(null);
    if (error) {
      notify.error(error.message);
      return;
    }
    setEntries((prev) =>
      prev.map((e) => (ids.includes(e.id) ? { ...e, settled: true, settled_at: nowIso } : e))
    );
    notify.success(ids.length > 1 ? `Marked ${ids.length} payments as paid` : "Marked as paid");
  }

  return { entries, settle, busyKey };
}
