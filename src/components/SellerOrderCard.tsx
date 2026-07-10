"use client";

import { useState } from "react";
import { inr, ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const NEXT: Record<string, { status: OrderStatus; label: string } | null> = {
  placed: { status: "accepted", label: "Accept order" },
  accepted: { status: "packed", label: "Mark packed" },
  packed: { status: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { status: "delivered", label: "Mark delivered" },
  delivered: null,
  cancelled: null,
};

interface Props {
  order: {
    id: string;
    status: OrderStatus;
    total: number;
    payment_status: string;
    created_at: string;
    delivery_slot: string | null;
  };
  items: { id: string; name: string; qty: number; price: number }[];
}

export function SellerOrderCard({ order, items }: Props) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [busy, setBusy] = useState(false);
  const next = NEXT[status];

  async function advance(to: OrderStatus) {
    setBusy(true);
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    if (res.ok) setStatus(to);
    setBusy(false);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-gray-500">#{order.id.slice(0, 8)}</span>
        <span className="badge bg-brand-50 text-brand-700">{ORDER_STATUS_LABELS[status]}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>{new Date(order.created_at).toLocaleString("en-IN")}</span>
        <span>{order.delivery_slot}</span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between">
            <span>{it.name} × {it.qty}</span>
            <span>{inr(it.price * it.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm">
          <b>{inr(order.total)}</b>{" "}
          <span className="uppercase text-gray-400">· {order.payment_status}</span>
        </span>
        <div className="flex gap-2">
          {status !== "delivered" && status !== "cancelled" && (
            <button
              className="btn-outline py-1 text-red-600"
              disabled={busy}
              onClick={() => advance("cancelled")}
            >
              Cancel
            </button>
          )}
          {next && (
            <button className="btn-primary py-1" disabled={busy} onClick={() => advance(next.status)}>
              {busy ? "…" : next.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
