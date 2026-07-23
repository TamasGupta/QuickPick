"use client";

import { useMemo } from "react";
import { Bike } from "lucide-react";
import { inr, formatIST } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

export interface RiderLedgerEntry extends LedgerEntry {
  rider_name: string | null;
}

// Groups a seller's seller->rider COD dues by rider, so the seller can pay
// each delivery partner in person after their shift and mark the whole
// batch settled in one tap — which then immediately reflects on that
// rider's own Earnings tab (same underlying rows, just a different view).
//
// Controlled component: entries/settle/busyKey come from the parent (via
// useLedgerSettle called ONCE at the page level) so settling here also
// updates any summary totals the parent derives from the same entries.
export function RiderPayoutsPanel({
  entries,
  onSettle,
  busyKey,
}: {
  entries: RiderLedgerEntry[];
  onSettle: (ids: string[], key: string) => void;
  busyKey: string | null;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, RiderLedgerEntry[]>();
    for (const e of entries) {
      const key = e.rider_id ?? "unknown";
      (map.get(key) ?? map.set(key, []).get(key)!).push(e);
    }
    return [...map.entries()].sort((a, b) => {
      const aPending = a[1].some((e) => !e.settled);
      const bPending = b[1].some((e) => !e.settled);
      return aPending === bPending ? 0 : aPending ? -1 : 1;
    });
  }, [entries]);

  if (groups.length === 0) {
    return <p className="p-6 text-center text-sm text-ink-faint">No delivery partner payments yet.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map(([riderId, riderEntries]) => {
        const pending = riderEntries.filter((e) => !e.settled);
        const pendingTotal = pending.reduce((s, e) => s + Number(e.amount), 0);
        const name = riderEntries[0].rider_name ?? "Delivery partner";
        return (
          <div key={riderId} className="card">
            <div className="flex items-center justify-between border-b border-gray-100 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                  <Bike className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{name}</p>
                  <p className="text-xs text-ink-faint">
                    {riderEntries.length} delivery{riderEntries.length > 1 ? "ies" : ""}
                    {pending.length > 0 ? ` · ${inr(pendingTotal)} pending` : " · all settled"}
                  </p>
                </div>
              </div>
              {pending.length > 0 && (
                <button
                  className="btn-primary py-1 text-xs"
                  disabled={busyKey === riderId}
                  onClick={() => onSettle(pending.map((e) => e.id), riderId)}
                >
                  {busyKey === riderId ? "…" : `Mark ${pending.length} received`}
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {riderEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{e.label}</p>
                    <p className="text-xs text-ink-faint">
                      {formatIST(e.created_at)}
                      {e.settled && e.settled_at ? ` · settled ${formatIST(e.settled_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-bold">{inr(e.amount)}</span>
                    {e.settled ? (
                      <span className="badge bg-brand-50 text-brand-700">Paid</span>
                    ) : (
                      <button
                        className="btn-outline py-1 text-xs"
                        disabled={busyKey === e.id}
                        onClick={() => onSettle([e.id], e.id)}
                      >
                        {busyKey === e.id ? "…" : "Mark received"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
