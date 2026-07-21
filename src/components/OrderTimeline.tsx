"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUS_FLOW, type OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/utils";

// Live order status timeline — subscribes to realtime updates so the buyer
// sees status changes without refreshing.
export function OrderTimeline({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: OrderStatus;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const supabase = createClient();

  // Resyncs when the parent Server Component re-fetches (via OrdersAutoRefresh
  // polling on the order detail page) — this component isn't remounted on a
  // router.refresh(), so without this its initial useState value would never
  // update even though a fresh `initialStatus` prop comes in.
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => setStatus((payload.new as { status: OrderStatus }).status)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, supabase]);

  if (status === "cancelled") {
    return <p className="badge bg-red-50 text-red-600">Order cancelled</p>;
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <ol className="relative ml-2 border-l-2 border-gray-200">
      {ORDER_STATUS_FLOW.map((s, i) => {
        const done = i <= currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s} className="mb-5 ml-4">
            <span
              className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${
                done ? "bg-brand-600" : "bg-gray-300"
              } ${active ? "ring-4 ring-brand-100" : ""}`}
            />
            <p className={`text-sm ${done ? "font-semibold text-gray-900" : "text-gray-400"}`}>
              {ORDER_STATUS_LABELS[s]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
