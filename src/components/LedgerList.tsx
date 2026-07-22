"use client";

import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inr, formatIST } from "@/lib/utils";
import { notify } from "@/store/notify";
import type { LedgerEntry } from "@/lib/types";

// Shared list UI for a set of ledger entries. `canSettle` controls whether
// the viewer is allowed to mark an unsettled row as paid — RLS enforces the
// real restriction (only the payer, or an admin, can actually update a row),
// this just decides whether to show the button at all.
export function LedgerList({
  entries: initial,
  canSettle,
  emptyLabel = "Nothing here yet.",
}: {
  entries: LedgerEntry[];
  canSettle: boolean;
  emptyLabel?: string;
}) {
  const [entries, setEntries] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function settle(id: string) {
    setBusyId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("ledger_entries")
      .update({ settled: true, settled_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      notify.error(error.message);
      return;
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, settled: true, settled_at: new Date().toISOString() } : e))
    );
  }

  if (entries.length === 0) {
    return <p className="p-6 text-center text-sm text-ink-faint">{emptyLabel}</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {entries.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{e.label}</p>
            <p className="text-xs text-ink-faint">
              {formatIST(e.created_at)}
              {e.settled && e.settled_at ? ` · settled ${formatIST(e.settled_at)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-bold text-ink">{inr(e.amount)}</span>
            {e.settled ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-brand-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Settled
              </span>
            ) : canSettle ? (
              <button
                className="btn-primary py-1 text-xs"
                disabled={busyId === e.id}
                onClick={() => settle(e.id)}
              >
                {busyId === e.id ? "…" : "Mark paid"}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                <Clock className="h-3.5 w-3.5" /> Pending
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
