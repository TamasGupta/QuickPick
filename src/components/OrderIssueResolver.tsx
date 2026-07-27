"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, Plus, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inr } from "@/lib/utils";
import { notify } from "@/store/notify";

interface Item {
  id: string;
  name: string;
  qty: number;
  price: number;
  out_of_stock: boolean;
  oos_reason: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  stock: number;
}

// Shown on the order detail page when a seller has reported a stock issue
// (order status 'action_required'). Lets the buyer continue without the
// flagged items or cancel outright; if continuing would drop the order
// below the minimum order value, offers to add more items first (COD only
// — an online order already collected a fixed amount up front).
export function OrderIssueResolver({
  orderId,
  sellerId,
  paymentStatus,
  items,
}: {
  orderId: string;
  sellerId: string;
  paymentStatus: string;
  items: Item[];
}) {
  const [busy, setBusy] = useState(false);
  const [shortBy, setShortBy] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});

  const flagged = items.filter((i) => i.out_of_stock);

  useEffect(() => {
    if (shortBy == null || paymentStatus !== "cod") return;
    const supabase = createClient();
    supabase
      .from("products")
      .select("id, name, price, unit, stock")
      .eq("seller_id", sellerId)
      .eq("is_active", true)
      .gt("stock", 0)
      .then(({ data }) => setProducts((data as Product[]) ?? []));
  }, [shortBy, paymentStatus, sellerId]);

  async function resolve(action: "continue" | "cancel", extraItems?: { product_id: string; qty: number }[]) {
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/resolve-issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, extraItems }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (json.code === "below_minimum") {
        setShortBy(json.shortBy);
        if (extraItems?.length) notify.error("Still short of the minimum — add a bit more.");
        return;
      }
      notify.error(json.error ?? "Something went wrong");
      return;
    }
    setShortBy(null);
    notify.success(action === "cancel" ? "Order cancelled" : "Order continuing without those items");
    // The regular 8s poll on the parent picks up the new status shortly;
    // no need to duplicate that logic here.
  }

  function addAndContinue() {
    const extraItems = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([product_id, q]) => ({ product_id, qty: q }));
    if (extraItems.length === 0) return notify.error("Add at least one item first.");
    resolve("continue", extraItems);
  }

  return (
    <section className="card space-y-3 border-2 border-dashed border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-bold text-ink">The store reported a stock issue</p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
            {flagged.map((i) => (
              <li key={i.id}>
                <b>{i.name}</b> × {i.qty} — {i.oos_reason ?? "Out of stock"}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {shortBy == null ? (
        <div className="flex gap-2">
          <button className="btn-outline flex-1 text-red-600" disabled={busy} onClick={() => resolve("cancel")}>
            Cancel order
          </button>
          <button className="btn-primary flex-1" disabled={busy} onClick={() => resolve("continue")}>
            Continue without these items
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-white p-3">
          <p className="text-sm font-semibold text-ink">
            Removing {flagged.length > 1 ? "those items" : "that item"} drops your order below the minimum —
            add {inr(shortBy)} more to continue, or cancel instead.
          </p>
          {paymentStatus === "cod" ? (
            <>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-ink-faint">{p.unit} · {inr(p.price)}</p>
                    </div>
                    <div className="qty-stepper shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty((q) => ({ ...q, [p.id]: Math.max(0, (q[p.id] ?? 0) - 1) }))}
                        aria-label="decrease"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-6 text-center font-bold">{qty[p.id] ?? 0}</span>
                      <button
                        type="button"
                        disabled={(qty[p.id] ?? 0) >= p.stock}
                        onClick={() => setQty((q) => ({ ...q, [p.id]: (q[p.id] ?? 0) + 1 }))}
                        aria-label="increase"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-sm text-ink-faint">No other items available from this store right now.</p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-outline flex-1 text-red-600" disabled={busy} onClick={() => resolve("cancel")}>
                  Cancel order
                </button>
                <button className="btn-primary flex-1" disabled={busy} onClick={addAndContinue}>
                  Add & continue
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-faint">
                This order was already paid online, so we can't add items to it — you're welcome to cancel and place
                a new order instead.
              </p>
              <button className="btn-outline w-full text-red-600" disabled={busy} onClick={() => resolve("cancel")}>
                Cancel order
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
