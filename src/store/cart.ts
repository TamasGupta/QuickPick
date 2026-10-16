"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_CART_ITEMS } from "@/lib/utils";

export interface CartItem {
  id: string; // product id
  seller_id: string;
  name: string;
  price: number;
  image_url: string | null;
  unit: string | null;
  qty: number;
  stock: number;
  max_order_qty?: number | null;
}

export type AddToCartResult =
  | { ok: true }
  | { ok: false; reason: "cart_limit" | "item_limit" | "out_of_stock"; limit?: number };

interface CartState {
  items: CartItem[];
  // Returns true (or AddToCartResult) on success, or false if blocked by limits
  add: (
    item: Omit<CartItem, "qty">,
    qty?: number,
    options?: { maxLimit?: number; maxCartItems?: number }
  ) => boolean;
  remove: (id: string) => void;
  setQty: (id: string, qty: number, maxLimit?: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
  // Quick-commerce v1 rule: one seller per order. Returns the seller_id if
  // the cart is non-empty, else null.
  sellerId: () => string | null;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, qty = 1, options) => {
        const state = get();
        const existing = state.items.find((i) => i.id === item.id);
        const maxCartDistinct = options?.maxCartItems ?? MAX_CART_ITEMS;

        if (!existing && state.items.length >= maxCartDistinct) return false;

        const effectiveMax = options?.maxLimit ?? item.max_order_qty ?? item.stock;
        const allowedMax = Math.min(item.stock, effectiveMax > 0 ? effectiveMax : item.stock);

        if (existing) {
          if (existing.qty >= allowedMax) return false;
          const nextQty = Math.min(existing.qty + qty, allowedMax);
          set({
            items: state.items.map((i) =>
              i.id === item.id ? { ...i, ...item, qty: nextQty } : i
            ),
          });
          return true;
        }

        if (allowedMax <= 0) return false;
        const initialQty = Math.min(qty, allowedMax);
        set({
          items: [...state.items, { ...item, qty: initialQty }],
        });
        return true;
      },
      remove: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      setQty: (id, qty, maxLimit) =>
        set((state) => {
          if (qty <= 0) {
            return { items: state.items.filter((i) => i.id !== id) };
          }
          return {
            items: state.items.map((i) => {
              if (i.id !== id) return i;
              const limit = maxLimit ?? i.max_order_qty ?? i.stock;
              const allowedMax = Math.min(i.stock, limit > 0 ? limit : i.stock);
              return { ...i, qty: Math.min(qty, allowedMax) };
            }),
          };
        }),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
      sellerId: () => get().items[0]?.seller_id ?? null,
    }),
    { name: "quickpick-cart" }
  )
);
