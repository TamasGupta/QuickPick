"use client";

import { useMemo } from "react";
import { inr, formatIST } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

// Calendar day (IST) an entry falls on, as a sortable YYYY-MM-DD key.
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function dayLabel(key: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Groups ledger entries by the day they were created (i.e. the day the order
// was delivered) — payments settle with a one-day lag in this app's flow, so
// "Yesterday" is normally the section that actually needs action today.
//
// Controlled component: entries/settle/busyKey all come from the parent (via
// useLedgerSettle called ONCE at the page level) so that settling here also
// updates any summary totals the parent derives from the same entries.
export function DayGroupedLedger({
  entries,
  canSettle,
  onSettle,
  busyKey,
}: {
  entries: LedgerEntry[];
  canSettle: boolean;
  onSettle: (ids: string[], key: string) => void;
  busyKey: string | null;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of entries) {
      const k = dayKey(e.created_at);
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  if (groups.length === 0) {
    return <p className="p-6 text-center text-sm text-ink-faint">Nothing here yet.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map(([key, dayEntries]) => {
        const pending = dayEntries.filter((e) => !e.settled);
        const pendingTotal = pending.reduce((s, e) => s + Number(e.amount), 0);
        const isYesterday = dayLabel(key) === "Yesterday";
        return (
          <div key={key} className={`card ${isYesterday && pending.length > 0 ? "ring-2 ring-accent-400" : ""}`}>
            <div className="flex items-center justify-between border-b border-gray-100 p-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  {dayLabel(key)}
                  {isYesterday && pending.length > 0 && (
                    <span className="badge bg-accent-50 text-accent-600">Action needed</span>
                  )}
                </p>
                <p className="text-xs text-ink-faint">
                  {dayEntries.length} order{dayEntries.length > 1 ? "s" : ""}
                  {pending.length > 0 ? ` · ${inr(pendingTotal)} pending` : " · all settled"}
                </p>
              </div>
              {canSettle && pending.length > 0 && (
                <button
                  className="btn-primary py-1 text-xs"
                  disabled={busyKey === key}
                  onClick={() => onSettle(pending.map((e) => e.id), key)}
                >
                  {busyKey === key ? "…" : `Mark all ${pending.length} paid`}
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {dayEntries.map((e) => (
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
                      <span className="badge bg-brand-50 text-brand-700">Settled</span>
                    ) : canSettle ? (
                      <button
                        className="btn-outline py-1 text-xs"
                        disabled={busyKey === e.id}
                        onClick={() => onSettle([e.id], e.id)}
                      >
                        {busyKey === e.id ? "…" : "Mark paid"}
                      </button>
                    ) : (
                      <span className="badge bg-amber-50 text-amber-700">Pending</span>
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
