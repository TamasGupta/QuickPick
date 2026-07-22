"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Bike, Phone } from "lucide-react";
import { OrderTimeline } from "@/components/OrderTimeline";
import { LottieIcon } from "@/components/LottieIcon";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

interface Rider {
  full_name: string | null;
  phone: string | null;
}

interface LiveData {
  status: OrderStatus;
  delivery_otp: string | null;
  rider: Rider | null;
}

// Polls /api/orders/:id/live in the background and re-renders just the
// status-dependent parts of the order detail page in place — no navigation,
// so no loading.tsx flash between polls, unlike a router.refresh()-driven
// approach.
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
    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}/live`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as LiveData;
        if (alive) setData(json);
      } catch {
        /* ignore transient failures */
      }
    }
    const id = setInterval(poll, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [orderId]);

  const { status, delivery_otp, rider } = data;
  const active = status !== "delivered" && status !== "cancelled";
  const showOtp = active && delivery_otp && status !== "placed";

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Order #{orderIdShort}</h1>
        <span className="badge bg-brand-50 text-brand-700">{ORDER_STATUS_LABELS[status]}</span>
      </div>

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

      <section className="card p-4">
        <h2 className="mb-3 font-bold">Tracking</h2>
        <OrderTimeline status={status} />
      </section>
    </>
  );
}
