"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string; // product id
  seller_id: string;
  name: string;
  price: number;
  image_url: string | null;
  unit: string | null;
  qty: number;
  stock: number;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
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
      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id
                  ? { ...i, qty: Math.min(i.qty + qty, i.stock) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, qty: Math.min(qty, item.stock) }] };
        }),
      remove: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) =>
                  i.id === id ? { ...i, qty: Math.min(qty, i.stock) } : i
                ),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
      sellerId: () => get().items[0]?.seller_id ?? null,
    }),
    { name: "quickpick-cart" }
  )
);
