"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, ShoppingCart, Clock, ArrowRight } from "lucide-react";
import { useCart } from "@/store/cart";
import { inr, DELIVERY_FEE, OTHER_CHARGES, MIN_ORDER } from "@/lib/utils";

export default function CartPage() {
  const router = useRouter();
  const { items, setQty, remove, subtotal } = useCart();
  const sub = subtotal();
  const belowMin = sub > 0 && sub < MIN_ORDER;
  const total = sub + (sub > 0 ? DELIVERY_FEE + OTHER_CHARGES : 0);

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ShoppingCart className="h-8 w-8" />
        </span>
        <p className="font-bold text-ink">Your cart is empty</p>
        <p className="mt-1 text-sm text-ink-faint">Add items to get them delivered in minutes.</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Your cart</h1>

      {/* Delivery ETA banner */}
      <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Clock className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-ink">Delivery in 11 minutes</p>
          <p className="text-xs text-ink-faint">Shipment of {items.length} item{items.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
              {i.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.image_url} alt={i.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">🛍️</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{i.name}</p>
              <p className="text-xs text-ink-faint">{i.unit}</p>
              <p className="mt-0.5 text-sm font-bold text-ink">{inr(i.price)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="qty-stepper">
                <button onClick={() => setQty(i.id, i.qty - 1)} aria-label="decrease">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-6 text-center text-sm font-bold">{i.qty}</span>
                <button disabled={i.qty >= i.stock} onClick={() => setQty(i.id, i.qty + 1)} aria-label="increase">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                className="flex items-center gap-1 text-[11px] text-ink-faint hover:text-red-500"
                onClick={() => remove(i.id)}
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bill */}
      <div className="card space-y-2.5 p-4 text-sm">
        <p className="font-bold text-ink">Bill details</p>
        <div className="flex justify-between text-ink-soft"><span>Item total</span><span>{inr(sub)}</span></div>
        <div className="flex justify-between text-ink-soft"><span>Delivery fee</span><span>{inr(DELIVERY_FEE)}</span></div>
        <div className="flex justify-between text-ink-soft"><span>Other charges</span><span>{inr(OTHER_CHARGES)}</span></div>
        <div className="flex justify-between border-t border-dashed border-gray-200 pt-2.5 text-base font-extrabold text-ink">
          <span>To pay</span><span>{inr(total)}</span>
        </div>
      </div>

      {belowMin && (
        <p className="rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-600">
          Add {inr(MIN_ORDER - sub)} more to reach the minimum order of {inr(MIN_ORDER)}.
        </p>
      )}

      <button className="btn-primary w-full py-3.5 text-base" disabled={belowMin} onClick={() => router.push("/checkout")}>
        Proceed to checkout · {inr(total)} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
