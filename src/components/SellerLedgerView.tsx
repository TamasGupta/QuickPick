"use client";

import { useMemo } from "react";
import { useLedgerSettle } from "@/hooks/useLedgerSettle";
import { DayGroupedLedger } from "@/components/DayGroupedLedger";
import { RiderPayoutsPanel, type RiderLedgerEntry } from "@/components/RiderPayoutsPanel";
import { inr } from "@/lib/utils";

// Single source of truth for this seller's whole ledger — settling anything
// below (a day, a rider, a single row) updates this same state, so the
// summary cards up top recompute immediately instead of staying frozen at
// whatever they were on page load.
export function SellerLedgerView({
  initialEntries,
  lifetimeEarnings,
}: {
  initialEntries: RiderLedgerEntry[];
  lifetimeEarnings: number;
}) {
  const { entries, settle, busyKey } = useLedgerSettle(initialEntries);

  const { owedToYou, platformDues, riderDues, owedToYouPending, needToPayPending } = useMemo(() => {
    const owedToYou = entries.filter((e) => e.to_party === "seller");
    const platformDues = entries.filter((e) => e.from_party === "seller" && e.to_party === "admin");
    const riderDues = entries.filter((e) => e.from_party === "seller" && e.to_party === "rider");
    const owedToYouPending = owedToYou.filter((e) => !e.settled).reduce((s, e) => s + Number(e.amount), 0);
    const needToPayPending = [...platformDues, ...riderDues]
      .filter((e) => !e.settled)
      .reduce((s, e) => s + Number(e.amount), 0);
    return { owedToYou, platformDues, riderDues, owedToYouPending, needToPayPending };
  }, [entries]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">You will get from Admin</p>
          <p className="mt-1 text-lg font-bold text-brand-700">{inr(owedToYouPending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">You need to pay</p>
          <p className="mt-1 text-lg font-bold text-red-600">{inr(needToPayPending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Lifetime earnings</p>
          <p className="mt-1 text-lg font-bold text-ink">{inr(lifetimeEarnings)}</p>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 font-bold">Delivery partner payments</h2>
        <p className="mb-2 text-xs text-ink-faint">
          You collect the full COD amount from each rider's deliveries — pay them their delivery-fee share directly,
          then mark it received here. It'll show as paid on their end too.
        </p>
        <RiderPayoutsPanel entries={riderDues} onSettle={settle} busyKey={busyKey} />
      </div>

      <div className="mt-5">
        <h2 className="mb-2 font-bold">You need to pay — platform fees (by day)</h2>
        <DayGroupedLedger entries={platformDues} canSettle onSettle={settle} busyKey={busyKey} />
      </div>

      <div className="mt-5">
        <h2 className="mb-2 font-bold">You will get from Admin — online order payouts (by day)</h2>
        <DayGroupedLedger entries={owedToYou} canSettle={false} onSettle={settle} busyKey={busyKey} />
      </div>
    </div>
  );
}
