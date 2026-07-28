"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Bike, Phone } from "lucide-react";
import { OrderTimeline } from "@/components/OrderTimeline";
import { OrderIssueResolver } from "@/components/OrderIssueResolver";
import { LottieIcon } from "@/components/LottieIcon";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

interface Rider {
  full_name: string | null;
  phone: string | null;
}

interface Item {
  id: string;
  name: string;
  qty: number;
  price: number;
  out_of_stock: boolean;
  oos_reason: string | null;
}

interface LiveData {
  status: OrderStatus;
  delivery_otp: string | null;
  rider: Rider | null;
  seller_id: string;
  payment_status: string;
  cancel_reason: string | null;
  items: Item[];
}

// Re-renders just the status-dependent parts of the order detail page in
// place — no navigation, so no loading.tsx flash — when Postgres reports a
// change on this order or its items. Still goes through
// /api/orders/:id/live rather than a direct client query, since the rider's
// name/phone needs the service-role client (RLS keeps other users' profiles
// private) — the difference from the old approach is this only runs when
// something actually changed, not on an 8s timer regardless.
export function OrderStatusLive({
  orderId,
  orderIdShort,
  initial,
}: {
  orderId: string;
  orderIdShort: string;
  initial: LiveData;
}) {
  const [data, setData] = useState<LiveData>(initial);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const res = await fetch(`/api/orders/${orderId}/live`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as LiveData;
        if (alive) setData(json);
      } catch {
        /* ignore transient failures */
      }
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`order-live-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` },
        refresh
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const { status, delivery_otp, rider, seller_id, payment_status, cancel_reason, items } = data;
  const active = status !== "delivered" && status !== "cancelled";
  const showOtp = active && delivery_otp && status !== "placed" && status !== "action_required";

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Order #{orderIdShort}</h1>
        <span className="badge bg-brand-50 text-brand-700">{ORDER_STATUS_LABELS[status]}</span>
      </div>

      {status === "cancelled" && cancel_reason && (
        <section className="card flex items-start gap-2 border-2 border-dashed border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            <b>Cancelled by the store:</b> {cancel_reason}
          </p>
        </section>
      )}

      {status === "action_required" && (
        <OrderIssueResolver orderId={orderId} sellerId={seller_id} paymentStatus={payment_status} items={items} />
      )}

      {showOtp && (
        <section className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 p-4">
          <ShieldCheck className="h-8 w-8 shrink-0 text-brand-600" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Delivery OTP</p>
            <p className="text-3xl font-extrabold tracking-[0.35em] text-ink">{delivery_otp}</p>
            <p className="text-xs text-ink-soft">Share this with your delivery partner at handover.</p>
          </div>
        </section>
      )}

      {status === "out_for_delivery" && (
        <section className="card flex flex-col items-center p-2 text-center">
          <LottieIcon name="delivery-rider" className="h-32 w-32" />
          <p className="-mt-2 text-sm font-bold text-ink">Your order is on the way!</p>
        </section>
      )}

      {rider && active && (
        <section className="card flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Bike className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{rider.full_name ?? "Delivery partner"}</p>
              <p className="text-xs text-ink-faint">Your delivery partner</p>
            </div>
          </div>
          {rider.phone && (
            <a href={`tel:${rider.phone}`} className="btn-outline">
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
        </section>
      )}

      {status !== "action_required" && (
        <section className="card p-4">
          <h2 className="mb-3 font-bold">Tracking</h2>
          <OrderTimeline status={status} />
        </section>
      )}
    </>
  );
}
