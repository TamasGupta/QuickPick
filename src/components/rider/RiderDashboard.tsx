"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Package, MapPin, Phone, Navigation, Check, Store, RefreshCw, IndianRupee, Clock,
} from "lucide-react";
import { Spinner } from "@/components/Loader";
import { inr, formatIST } from "@/lib/utils";
import { notify } from "@/store/notify";
import type { RiderOrder } from "@/lib/rider";
import type { LedgerEntry } from "@/lib/types";

type Tab = "available" | "active" | "history" | "earnings";

const TABS: { key: Tab; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "active", label: "My deliveries" },
  { key: "history", label: "Completed" },
  { key: "earnings", label: "Earnings" },
];

// Turn-by-turn directions (not just a dropped pin) from wherever the rider
// currently is to the given destination — Google Maps auto-detects the
// origin as the device's live location when none is specified.
function directionsHref(dest: { lat: number | null; lng: number | null } | null, textParts: (string | null)[]) {
  if (dest?.lat != null && dest?.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
  }
  const q = textParts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export function RiderDashboard({ name }: { name: string }) {
  const [tab, setTab] = useState<Tab>("available");
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [availCount, setAvailCount] = useState(0);

  // `silent` skips the loading spinner — used for background polling so the
  // list just updates in place instead of flashing a spinner over it every
  // cycle. Tab switches and user-triggered refreshes stay non-silent since
  // there's a real wait with no prior data for that view yet.
  const load = useCallback(async (t: Tab, opts: { silent?: boolean } = {}) => {
    if (t === "earnings") return; // handled by <RiderEarnings> itself
    if (!opts.silent) setLoading(true);
    const res = await fetch(`/api/rider/orders?scope=${t}`, { cache: "no-store" });
    const json = await res.json();
    setOrders(json.orders ?? []);
    if (!opts.silent) setLoading(false);
  }, []);

  // Poll available count for the tab badge.
  const refreshAvailCount = useCallback(async () => {
    const res = await fetch(`/api/rider/orders?scope=available`, { cache: "no-store" });
    const json = await res.json();
    setAvailCount((json.orders ?? []).length);
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    refreshAvailCount();
    const id = setInterval(refreshAvailCount, 15000);
    return () => clearInterval(id);
  }, [refreshAvailCount]);

  // Riders read orders through a service-role API route (/api/rider/orders),
  // not a direct RLS-scoped client query — there's no orders_read policy
  // granting riders row visibility, so a client-side postgres_changes
  // subscription would never fire for them. Only "available" actually needs
  // background polling — new orders can appear there any time from other
  // sellers. "active"/"history" only ever change through this rider's own
  // actions (claim/pickup/deliver), which already refresh immediately after
  // completing, so polling them just causes needless flicker for no benefit.
  useEffect(() => {
    if (tab !== "available") return;
    const id = setInterval(() => load(tab, { silent: true }), 15000);
    return () => clearInterval(id);
  }, [tab, load]);

  async function act(action: string, order_id: string, otp?: string) {
    setBusyId(order_id);
    const res = await fetch(`/api/rider/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id, otp }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      notify.error(json.error ?? "Action failed");
      return false;
    }
    await Promise.all([load(tab), refreshAvailCount()]);
    return true;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 p-4 text-white shadow-pop">
        <div>
          <p className="text-xs text-white/80">Delivery partner</p>
          <p className="text-lg font-extrabold">{name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-white text-brand-700 shadow-sm" : "text-ink-soft"
            }`}
          >
            {t.label}
            {t.key === "available" && availCount > 0 && (
              <span className="absolute -right-0.5 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
                {availCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "earnings" ? (
        <RiderEarnings />
      ) : (
        <>
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-ink-faint">
          {loading ? "Loading…" : `${orders.length} order${orders.length === 1 ? "" : "s"}`}
        </span>
        <button onClick={() => load(tab)} className="btn-ghost text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7 border-brand-200 border-t-brand-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center text-ink-soft">
          <Package className="mx-auto h-10 w-10 text-ink-faint" />
          <p className="mt-3 font-semibold text-ink">
            {tab === "available"
              ? "No orders available right now"
              : tab === "active"
                ? "No active deliveries"
                : "No completed deliveries yet"}
          </p>
          <p className="mt-1 text-sm">New orders appear here as stores pack them.</p>
        </div>
      ) : (
        <div className="stagger space-y-3">
          {orders.map((o) => (
            <RiderOrderCard key={o.id} o={o} tab={tab} busy={busyId === o.id} act={act} />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function RiderEarnings() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [lifetime, setLifetime] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch("/api/rider/ledger", { cache: "no-store" });
      const json = await res.json();
      if (!alive) return;
      setEntries(json.entries ?? []);
      setLifetime(json.lifetimeEarnings ?? 0);
      setLoading(false);
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const owed = entries.filter((e) => !e.settled);
  const owedTotal = owed.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-7 w-7 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Owed to you</p>
          <p className="mt-1 text-lg font-bold text-brand-700">{inr(owedTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Lifetime earnings</p>
          <p className="mt-1 text-lg font-bold text-ink">{inr(lifetime)}</p>
        </div>
      </div>
      <p className="text-xs text-ink-faint">
        Online orders: the platform pays you directly. COD orders: the seller collected your share in cash along
        with theirs — they'll settle up with you.
      </p>
      <div className="card divide-y divide-gray-100">
        {entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-faint">No deliveries completed yet.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{e.label}</p>
                <p className="text-xs text-ink-faint">{formatIST(e.created_at)}</p>
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
  );
}

function RiderOrderCard({
  o,
  tab,
  busy,
  act,
}: {
  o: RiderOrder;
  tab: Tab;
  busy: boolean;
  act: (action: string, id: string, otp?: string) => Promise<boolean>;
}) {
  const [otp, setOtp] = useState("");
  const itemCount = o.items.reduce((n, i) => n + i.qty, 0);
  const isCod = o.payment_status === "cod";

  return (
    <div className="card space-y-3 p-4">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Store className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-ink">{o.store_name}</p>
            <p className="text-xs text-ink-faint">
              #{o.id.slice(0, 8)} · {itemCount} item{itemCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <span
          className={`badge ${isCod ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-700"}`}
        >
          {isCod ? "Collect COD" : "Prepaid"}
        </span>
      </div>

      {/* Earnings + total */}
      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
        <span className="flex items-center gap-1 font-semibold text-brand-700">
          <IndianRupee className="h-3.5 w-3.5" /> {inr(o.delivery_fee)} earning
        </span>
        <span className="text-ink-soft">
          Order {inr(o.total)}
          {isCod && <span className="font-semibold text-ink"> · collect {inr(o.total)}</span>}
        </span>
      </div>

      {/* Pickup leg: before the rider has collected the order, route to the
          store, not the buyer — they haven't got anything to deliver yet. */}
      {tab === "active" && o.status === "packed" && o.store && (
        <div className="space-y-2 rounded-xl border border-gray-100 p-3">
          <div className="flex items-start gap-2">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            <div className="text-sm">
              <p className="font-semibold text-ink">{o.store_name}</p>
              <p className="text-ink-soft">
                {[o.store.address_line, o.store.city, o.store.pincode].filter(Boolean).join(", ") || "Address not pinned"}
              </p>
            </div>
          </div>
          <a
            href={directionsHref(o.store, [o.store.address_line, o.store.city, o.store.pincode])}
            target="_blank"
            rel="noreferrer"
            className="btn-outline w-full"
          >
            <Navigation className="h-4 w-4" /> Navigate to store
          </a>
        </div>
      )}

      {/* Delivery leg: after pickup, route to the buyer's address. */}
      {tab === "active" && o.status === "out_for_delivery" && o.address && (
        <div className="space-y-2 rounded-xl border border-gray-100 p-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            <div className="text-sm">
              <p className="font-semibold text-ink">{o.buyer_name}</p>
              <p className="text-ink-soft">
                {[o.address.line1, o.address.line2, o.address.city, o.address.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {o.address.lat != null && (
                <p className="text-[11px] text-brand-600">Exact GPS location pinned</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={directionsHref(o.address, [o.address.line1, o.address.line2, o.address.city, o.address.pincode])}
              target="_blank"
              rel="noreferrer"
              className="btn-outline flex-1"
            >
              <Navigation className="h-4 w-4" /> Navigate to customer
            </a>
            {o.buyer_phone && (
              <a href={`tel:${o.buyer_phone.replace(/^91/, "")}`} className="btn-outline flex-1">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
          </div>
        </div>
      )}

      {/* Items preview */}
      <p className="text-xs text-ink-faint">
        {o.items.slice(0, 3).map((i) => `${i.name}×${i.qty}`).join(", ")}
        {o.items.length > 3 ? ` +${o.items.length - 3} more` : ""}
      </p>

      {/* Actions */}
      {tab === "available" && (
        <button
          onClick={() => act("claim", o.id)}
          disabled={busy}
          className="btn-primary w-full"
        >
          {busy ? <Spinner /> : <Check className="h-4 w-4" />} Accept delivery
        </button>
      )}

      {tab === "active" && o.status === "packed" && (
        <button
          onClick={() => act("pickup", o.id)}
          disabled={busy}
          className="btn-primary w-full"
        >
          {busy ? <Spinner /> : <Package className="h-4 w-4" />} Mark picked up
        </button>
      )}

      {tab === "active" && o.status === "out_for_delivery" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter 4-digit OTP"
              className="input text-center tracking-[0.3em]"
            />
            <button
              onClick={async () => {
                const ok = await act("deliver", o.id, otp);
                if (!ok) setOtp("");
              }}
              disabled={busy || otp.length !== 4}
              className="btn-primary shrink-0"
            >
              {busy ? <Spinner /> : <Check className="h-4 w-4" />} Deliver
            </button>
          </div>
          <p className="text-[11px] text-ink-faint">Ask the customer for their delivery OTP.</p>
        </div>
      )}

      {tab === "history" && (
        <p className="flex items-center gap-1 text-sm font-semibold text-brand-700">
          <Check className="h-4 w-4" /> Delivered
        </p>
      )}
    </div>
  );
}
