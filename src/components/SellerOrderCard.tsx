"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { inr, ORDER_STATUS_LABELS, formatIST } from "@/lib/utils";
import { notify } from "@/store/notify";
import { ReportOrderIssueModal } from "@/components/ReportOrderIssueModal";
import type { OrderStatus } from "@/lib/types";

// Seller drives the order up to "packed"; a delivery partner then picks it up
// and completes delivery (see the rider flow).
const NEXT: Record<string, { status: OrderStatus; label: string } | null> = {
  placed: { status: "accepted", label: "Accept order" },
  accepted: { status: "packed", label: "Mark packed" },
  packed: null,
  out_for_delivery: null,
  delivered: null,
  cancelled: null,
  action_required: null,
};

const HANDOFF_NOTE: Record<string, string> = {
  packed: "Ready for pickup — waiting for a delivery partner",
  out_for_delivery: "Picked up — out for delivery",
  delivered: "Delivered to the customer",
};

// Seller can report a stock issue up to the point a rider has it.
const REPORTABLE: OrderStatus[] = ["placed", "accepted", "packed"];

interface Props {
  order: {
    id: string;
    status: OrderStatus;
    total: number;
    payment_status: string;
    created_at: string;
    delivery_slot: string | null;
  };
  items: { id: string; name: string; qty: number; price: number; out_of_stock?: boolean }[];
}

export function SellerOrderCard({ order, items }: Props) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [busy, setBusy] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const next = NEXT[status];

  // Local state gives an instant optimistic update on click; this resyncs it
  // whenever SellerOrdersList's background poll passes down a fresh `order`
  // prop — otherwise, since the component isn't remounted (same key),
  // useState's initial value would never update
  // and a status change made elsewhere (rider app, another tab) wouldn't show.
  useEffect(() => {
    setStatus(order.status);
  }, [order.status]);

  async function advance(to: OrderStatus) {
    setBusy(true);
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    if (res.ok) {
      setStatus(to);
    } else {
      const json = await res.json().catch(() => ({}));
      notify.error(json.error ?? "Couldn't update order status");
    }
    setBusy(false);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-gray-500">#{order.id.slice(0, 8)}</span>
        <span className="badge bg-brand-50 text-brand-700">{ORDER_STATUS_LABELS[status]}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>{formatIST(order.created_at)}</span>
        <span>{order.delivery_slot}</span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between">
            <span className={it.out_of_stock ? "text-ink-faint line-through" : ""}>
              {it.name} × {it.qty}
            </span>
            <span className={it.out_of_stock ? "text-ink-faint line-through" : ""}>{inr(it.price * it.qty)}</span>
          </li>
        ))}
      </ul>

      {HANDOFF_NOTE[status] && (
        <p className="mt-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
          {HANDOFF_NOTE[status]}
        </p>
      )}
      {status === "action_required" && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Waiting for the buyer to respond to the stock issue you reported.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm">
          <b>{inr(order.total)}</b>{" "}
          <span className="uppercase text-gray-400">· {order.payment_status}</span>
        </span>
        <div className="flex gap-2">
          {REPORTABLE.includes(status) && (
            <button
              className="btn-outline py-1 text-red-600"
              disabled={busy}
              onClick={() => setShowIssueModal(true)}
            >
              Report issue
            </button>
          )}
          {next && (
            <button className="btn-primary py-1" disabled={busy} onClick={() => advance(next.status)}>
              {busy ? "…" : next.label}
            </button>
          )}
        </div>
      </div>

      {showIssueModal && (
        <ReportOrderIssueModal
          orderId={order.id}
          items={items}
          onClose={() => setShowIssueModal(false)}
          onDone={(newStatus) => {
            setStatus(newStatus);
            setShowIssueModal(false);
          }}
        />
      )}
    </div>
  );
}
