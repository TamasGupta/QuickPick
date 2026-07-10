"use client";

import { Plus, Minus, Clock } from "lucide-react";
import { useCart } from "@/store/cart";
import { inr } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const items = useCart((s) => s.items);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const inCart = items.find((i) => i.id === product.id);
  const out = product.stock <= 0;
  const discount =
    product.mrp && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <div className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-2 shadow-card transition hover:shadow-pop">
      {/* Image */}
      <div className="relative mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-50">
        {discount > 0 && (
          <span className="absolute left-0 top-0 rounded-br-xl rounded-tl-xl bg-brand-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            {discount}% OFF
          </span>
        )}
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-4xl opacity-70">🛍️</span>
        )}
      </div>

      {/* Delivery time */}
      <div className="mb-1 inline-flex w-fit items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
        <Clock className="h-2.5 w-2.5" /> 11 MINS
      </div>

      {/* Name + unit */}
      <h3 className="line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-tight text-ink">
        {product.name}
      </h3>
      <span className="mb-2 text-xs text-ink-faint">{product.unit}</span>

      {/* Price + add */}
      <div className="mt-auto flex items-center justify-between">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-ink">{inr(product.price)}</span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-[11px] text-ink-faint line-through">{inr(product.mrp)}</span>
          )}
        </div>

        {out ? (
          <span className="badge bg-gray-100 px-2 py-1 text-ink-faint">Sold out</span>
        ) : inCart ? (
          <div className="qty-stepper animate-bounce-in">
            <button onClick={() => setQty(product.id, inCart.qty - 1)} aria-label="decrease">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-6 text-center text-sm font-bold">{inCart.qty}</span>
            <button
              disabled={inCart.qty >= product.stock}
              onClick={() => setQty(product.id, inCart.qty + 1)}
              aria-label="increase"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            className="add-pill"
            onClick={() =>
              add({
                id: product.id,
                seller_id: product.seller_id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                unit: product.unit,
                stock: product.stock,
              })
            }
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
