"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, MapPin, Phone, Navigation, Check, Store, RefreshCw, IndianRupee, Clock, User as UserIcon, LogOut, ChevronDown, AlertTriangle, ChevronLeft, ChevronRight, Calendar, CreditCard, Banknote, QrCode, AlertCircle, CheckCircle,
} from "lucide-react";
import { Spinner } from "@/components/Loader";
import { createClient } from "@/lib/supabase/client";
import { inr, formatIST } from "@/lib/utils";
import { notify } from "@/store/notify";
import type { RiderOrder } from "@/lib/rider";
import type { LedgerEntry } from "@/lib/types";
import { RiderOrderCard } from "./RiderOrderCard";

export type Tab = "available" | "active" | "history" | "earnings" | "profile";

const TABS: { key: Tab; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "active", label: "My deliveries" },
  { key: "history", label: "Completed" },
  { key: "earnings", label: "Earnings" },
  { key: "profile", label: "Profile" },
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

export function RiderDashboard({
  name,
  email,
  phone,
}: {
  name: string;
  email: string | null;
  phone: string | null;
}) {
const [tab, setTab] = useState<Tab>("available");
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [availCount, setAvailCount] = useState(0);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const buildUrl = useCallback((t: Tab, p = page) => {
    const params = new URLSearchParams({ scope: t, limit: String(limit), offset: String(p * limit) });
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    return `/api/rider/orders?${params.toString()}`;
  }, [page, limit, fromDate, toDate]);

  const load = useCallback(async (t: Tab, opts: { silent?: boolean } = {}) => {
    if (t === "earnings" || t === "profile") return;
    if (!opts.silent) setLoading(true);
    try {
      const res = await fetch(buildUrl(t), { 
        cache: "no-store",
        credentials: 'include',
      });
      console.log(`[rider] load ${t} response status:`, res.status);
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[rider] load ${t} failed:`, res.status, errText);
        return;
      }
      const json = await res.json();
      console.log(`[rider] load ${t} received:`, json.orders?.length ?? 0, "orders", json.orders?.slice(0,1), "total:", json.total);
      setOrders(json.orders ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      console.error(`[rider] load ${t} error:`, err);
    }
    if (!opts.silent) setLoading(false);
  }, [buildUrl]);

  useEffect(() => {
    setPage(0);
    load(tab);
  }, [tab, load, fromDate, toDate]);

  // Poll available count for the tab badge.
  const refreshAvailCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/rider/orders?scope=available&limit=1`, { 
        cache: "no-store",
        credentials: 'include',
      });
      if (!res.ok) {
        console.error(`[rider] refreshAvailCount failed:`, res.status, await res.text());
        return;
      }
      const json = await res.json();
      setAvailCount(json.total ?? 0);
    } catch (err) {
      console.error(`[rider] refreshAvailCount error:`, err);
    }
  }, []);

  // Realtime-driven, not polled: migration 017 added a scoped RLS policy
  // (packed + unclaimed + caller is a rider) so riders can now see this
  // slice of `orders` directly, exposing exactly what the service-role
  // /api/rider/orders?scope=available route already returned. Subscribes
  // once (not per-tab) and reads the current tab via a ref so switching
  // tabs doesn't tear down and resubscribe the channel.
  //
  // One gap: RLS decides whether to deliver an UPDATE event by re-checking
  // the policy against the NEW row, so a rider watching this list gets no
  // signal when ANOTHER rider claims an order out from under them (the row
  // simply stops matching, it isn't reported as a removal). Fixing that
  // fully needs REPLICA IDENTITY FULL on `orders`, which we're not turning
  // on solely for this (bigger WAL cost for every column on every order
  // update, app-wide). The 60s fallback below just catches that edge case
  // eventually; correctness doesn't depend on it — /api/rider/claim's
  // atomic update already rejects a stale double-claim with a 409.
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    const supabase = createClient();
    function refreshAvailable() {
      refreshAvailCount();
      if (tabRef.current === "available") {
        console.log("[rider] Realtime triggered refresh");
        load("available", { silent: true });
      }
    }
    refreshAvailable();
    const channel = supabase
      .channel("rider-available-orders")
      .on(
        // No filter: the orders_read_available_for_riders RLS policy (see
        // migration 020) already scopes this to unclaimed placed/accepted/
        // packed orders, and a status change out of that range (e.g. another
        // rider claiming it) needs to trigger a refresh too so the card
        // disappears from this list.
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        refreshAvailable
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAvailCount, load]);

  async function act(action: string, order_id: string, otp?: string, paymentMode?: "cash" | "upi") {
    setBusyId(order_id);
    const res = await fetch(`/api/rider/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id, otp, payment_mode: paymentMode }),
      credentials: 'include',
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      notify.error(json.error ?? "Action failed");
      if (json.requirePayment) {
        return { ok: false, requirePayment: true };
      }
      return { ok: false };
    }
    await Promise.all([load(tab), refreshAvailCount()]);
    return { ok: true, remittanceDue: json.remittance_due ?? json.remittanceDue };
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
      ) : tab === "profile" ? (
        <RiderProfile name={name} phone={phone} />
      ) : (
        <>
        <div className="flex flex-col gap-3 px-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-ink-faint" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input text-xs w-36"
                placeholder="From"
              />
              <span className="text-ink-faint text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input text-xs w-36"
                placeholder="To"
              />
              {(fromDate || toDate) && (
                <button
                  onClick={() => { setFromDate(""); setToDate(""); }}
                  className="btn-ghost text-xs h-8"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1" />
            <span className="text-sm text-ink-faint">
              {loading ? "Loading…" : `${orders.length} of ${total} order${total === 1 ? "" : "s"}`}
            </span>
            <button onClick={() => load(tab)} className="btn-ghost text-xs" disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {total > limit && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="btn-outline text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-sm text-ink-faint">
                Page {page + 1} of {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(Math.ceil(total / limit) - 1, p + 1))}
                disabled={(page + 1) * limit >= total || loading}
                className="btn-outline text-xs"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
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
            <p className="mt-1 text-sm">New orders appear here as soon as they're placed.</p>
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
  const [remittanceOrders, setRemittanceOrders] = useState<Array<{
    id: string;
    order_id: string;
    amount: number;
    status: string;
    razorpay_order_id: string | null;
    key_id: string | null;
  }>>([]);
  const [selectedRemittance, setSelectedRemittance] = useState<{
    orderId: string;
    amount: number;
    keyId: string;
    razorpayOrderId: string;
  } | null>(null);

  // Realtime-driven, not polled: ledger_entries already has an RLS policy
  // letting a rider read rows where rider_id = auth.uid() directly (unlike
  // `orders`, which has no rider-facing policy at all — see rider.ts), so a
  // client-side subscription works with no policy changes. A new ledger
  // entry only ever appears alongside a delivery completing, which is
  // exactly when lifetimeEarnings needs refreshing too, so one subscription
  // covers both.
  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const res = await fetch("/api/rider/ledger", { cache: "no-store" });
      const json = await res.json();
      if (!alive) return;
      setEntries(json.entries ?? []);
      setLifetime(json.lifetimeEarnings ?? 0);
      setLoading(false);
    }

    async function loadRemittances() {
      const res = await fetch("/api/rider/remittances", { cache: "no-store" });
      const json = await res.json();
      if (!alive) return;
      setRemittanceOrders(json.remittances ?? []);
    }

    // getSession() reads the cached session locally — no network round-trip,
    // unlike getUser(). UI state feeding an RLS-scoped subscription, not a
    // security decision.
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user || !alive) return;
      load();
      loadRemittances();
      channel = supabase
        .channel(`rider-ledger-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ledger_entries", filter: `rider_id=eq.${user.id}` },
          load
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `rider_id=eq.${user.id}` },
          loadRemittances
        )
        .subscribe();
    });

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const owed = entries.filter((e) => !e.settled);
  const owedTotal = owed.reduce((s, e) => s + Number(e.amount), 0);
  const pendingRemittances = remittanceOrders.filter((r) => r.status === "pending");

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

      {/* Pending Remittances */}
      {pendingRemittances.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-700 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Remittance Due ({pendingRemittances.length})
            </p>
          </div>
          <div className="card divide-y divide-gray-100">
            {pendingRemittances.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-ink">Remit to Platform</span>
                    <span className="badge bg-amber-50 text-amber-700">₹{r.amount}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRemittance({
                        orderId: r.order_id,
                        amount: r.amount,
                        keyId: r.key_id ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
                        razorpayOrderId: r.razorpay_order_id ?? "",
                      });
                    }}
                    className="btn-primary text-xs"
                  >
                    <QrCode className="h-3.5 w-3.5" /> Pay via QR
                  </button>
                </div>
                <p className="text-xs text-ink-faint ml-7">
                  Order #{r.order_id.slice(0, 8)} · COD cash collected · You keep delivery fee, remit rest to platform
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        Online orders: the platform pays you directly. COD orders: you collected cash from buyer — keep
        delivery fee as earnings, remit the rest (subtotal + platform fee) to platform via QR.
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

function RiderProfile({
  name,
  phone,
}: {
  name: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600">
          <UserIcon className="h-7 w-7 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{name}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
            <Phone className="h-3 w-3" />
            {phone ? `+${phone}` : "No phone on file"}
          </p>
        </div>
      </div>

      <button
        onClick={logout}
        disabled={loggingOut}
        className="btn-outline w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        {loggingOut ? "Logging out…" : "Log out"}
      </button>
    </div>
  );
}