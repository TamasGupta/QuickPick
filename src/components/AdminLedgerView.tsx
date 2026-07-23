"use client";

import { useMemo } from "react";
import { useLedgerSettle } from "@/hooks/useLedgerSettle";
import { DayGroupedLedger } from "@/components/DayGroupedLedger";
import { inr, formatIST } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

export interface AdminLedgerEntry extends LedgerEntry {
  seller_name: string | null;
  rider_name: string | null;
}

// Single source of truth for the platform's whole ledger view — settling
// anything below recomputes the summary cards immediately from the same
// state, instead of them staying frozen at page-load values.
export function AdminLedgerView({
  initialEntries,
  lifetimeRevenue,
}: {
  initialEntries: AdminLedgerEntry[];
  lifetimeRevenue: number;
}) {
  const { entries, settle, busyKey } = useLedgerSettle(initialEntries);

  const { owedToYou, needToPay, owedToYouPending, needToPayPending } = useMemo(() => {
    const owedToYou = entries.filter((e) => e.to_party === "admin");
    const needToPay = entries.filter((e) => e.from_party === "admin");
    const owedToYouPending = owedToYou.filter((e) => !e.settled).reduce((s, e) => s + Number(e.amount), 0);
    const needToPayPending = needToPay.filter((e) => !e.settled).reduce((s, e) => s + Number(e.amount), 0);
    return { owedToYou, needToPay, owedToYouPending, needToPayPending };
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">You will get from Sellers</p>
          <p className="mt-1 text-lg font-bold text-brand-700">{inr(owedToYouPending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">You need to pay</p>
          <p className="mt-1 text-lg font-bold text-red-600">{inr(needToPayPending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Lifetime platform revenue</p>
          <p className="mt-1 text-lg font-bold text-ink">{inr(lifetimeRevenue)}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-bold">You will get from Sellers — COD platform fees (by day)</h2>
        <DayGroupedLedger entries={owedToYou} canSettle onSettle={settle} busyKey={busyKey} />
      </div>

      <div>
        <h2 className="mb-2 font-bold">You need to pay — online order payouts (by day)</h2>
        <DayGroupedLedger entries={needToPay} canSettle onSettle={settle} busyKey={busyKey} />
      </div>

      <div>
        <h2 className="mb-2 font-bold">Full ledger ({entries.length})</h2>
        <div className="card divide-y divide-gray-100">
          {entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-faint">No ledger entries yet.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{e.label}</p>
                  <p className="text-xs text-ink-faint">
                    {e.from_party} → {e.to_party} · {e.seller_name ?? "—"}
                    {e.rider_name ? ` · ${e.rider_name}` : ""} · {formatIST(e.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-bold">{inr(e.amount)}</span>
                  <span className={`badge ${e.settled ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
                    {e.settled ? "Settled" : "Pending"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
