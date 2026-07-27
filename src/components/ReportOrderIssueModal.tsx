"use client";

import { useState } from "react";
import { X, TriangleAlert } from "lucide-react";
import { inr } from "@/lib/utils";
import { notify } from "@/store/notify";

interface Item {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export function ReportOrderIssueModal({
  orderId,
  items,
  onClose,
  onDone,
}: {
  orderId: string;
  items: Item[];
  onClose: () => void;
  onDone: (status: "action_required" | "cancelled") => void;
}) {
  const [mode, setMode] = useState<"items" | "full">("items");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [fullReason, setFullReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const anyChecked = Object.values(checked).some(Boolean);

  function toggle(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  async function submitItems() {
    const flagged = items.filter((it) => checked[it.id]);
    if (flagged.length === 0) return;
    setSubmitting(true);
    const res = await fetch(`/api/orders/${orderId}/report-issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullCancel: false,
        items: flagged.map((it) => ({ order_item_id: it.id, reason: reasons[it.id] || "Out of stock" })),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return notify.error(json.error ?? "Couldn't report the issue");
    notify.success("Buyer notified — waiting for their response");
    onDone("action_required");
  }

  async function submitFullCancel() {
    if (!fullReason.trim()) return notify.error("Please add a reason for the buyer.");
    setSubmitting(true);
    const res = await fetch(`/api/orders/${orderId}/report-issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullCancel: true, reason: fullReason.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return notify.error(json.error ?? "Couldn't cancel the order");
    notify.success("Order cancelled");
    onDone("cancelled");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">
            {mode === "items" ? "Report a stock issue" : "Cancel this order"}
          </h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === "items" ? (
          <>
            <p className="mb-3 text-sm text-ink-soft">
              Mark whichever items you're out of stock on — the buyer will be asked whether to continue without
              them or cancel the order.
            </p>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-gray-100 p-3">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!checked[it.id]}
                      onChange={() => toggle(it.id)}
                    />
                    <span className="flex-1">
                      <span className="flex justify-between text-sm font-medium text-ink">
                        <span>{it.name} × {it.qty}</span>
                        <span>{inr(it.price * it.qty)}</span>
                      </span>
                    </span>
                  </label>
                  {checked[it.id] && (
                    <input
                      className="input mt-2 text-sm"
                      placeholder="Reason (e.g. Out of stock)"
                      value={reasons[it.id] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [it.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              className="btn-primary mt-4 w-full"
              disabled={!anyChecked || submitting}
              onClick={submitItems}
            >
              {submitting ? "Sending…" : "Notify buyer"}
            </button>
            <button
              type="button"
              onClick={() => setMode("full")}
              className="mt-2 w-full text-center text-sm text-red-600 hover:underline"
            >
              Need to cancel the whole order instead?
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              This cancels the entire order right away — the buyer can't choose to continue with part of it.
            </div>
            <textarea
              className="input min-h-24 w-full text-sm"
              placeholder="Reason for the buyer (e.g. Store closing early today)"
              value={fullReason}
              onChange={(e) => setFullReason(e.target.value)}
            />
            <button
              className="btn-primary mt-4 w-full bg-red-600 hover:bg-red-700"
              disabled={submitting}
              onClick={submitFullCancel}
            >
              {submitting ? "Cancelling…" : "Cancel order"}
            </button>
            <button
              type="button"
              onClick={() => setMode("items")}
              className="mt-2 w-full text-center text-sm text-ink-soft hover:underline"
            >
              Back to reporting specific items
            </button>
          </>
        )}
      </div>
    </div>
  );
}
