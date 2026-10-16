"use client";

import { create } from "zustand";
import { DELIVERY_FEE, OTHER_CHARGES, MAX_CART_ITEMS, MIN_ORDER } from "@/lib/utils";
import type { AppSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: AppSettings = {
  id: "default",
  delivery_fee: DELIVERY_FEE,
  other_charges: OTHER_CHARGES,
  min_order_amount: MIN_ORDER,
  max_cart_items: MAX_CART_ITEMS,
  max_qty_per_product: 10,
};

interface SettingsState {
  settings: AppSettings;
  restrictions: Record<string, number>;
  loading: boolean;
  loaded: boolean;
  fetchSettings: (force?: boolean) => Promise<void>;
  getProductLimit: (productId: string, stock: number, productMaxOrderQty?: number | null) => number;
  getProductRestriction: (productId: string, productMaxOrderQty?: number | null) => number | null;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  restrictions: {},
  loading: false,
  loaded: false,
  fetchSettings: async (force = false) => {
    const { loaded, loading } = get();
    if (loading) return;
    if (loaded && !force) return;

    set({ loading: true });
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        set({
          settings: data.settings ?? DEFAULT_SETTINGS,
          restrictions: data.restrictions ?? {},
          loaded: true,
        });
      }
    } catch {
      // Fallback stays in place
    } finally {
      set({ loading: false });
    }
  },
  getProductLimit: (productId: string, stock: number, productMaxOrderQty?: number | null) => {
    const { restrictions, settings } = get();
    const customLimit = restrictions[productId] ?? productMaxOrderQty;
    const effectiveLimit = customLimit && customLimit > 0 ? customLimit : settings.max_qty_per_product;
    return Math.max(0, Math.min(stock, effectiveLimit));
  },
  getProductRestriction: (productId: string, productMaxOrderQty?: number | null) => {
    const { restrictions } = get();
    const customLimit = restrictions[productId] ?? productMaxOrderQty;
    return customLimit && customLimit > 0 ? customLimit : null;
  },
}));

// Convenience hook
export function useSettings() {
  const store = useSettingsStore();
  // Auto-fetch on first hook mount if not already loaded
  if (typeof window !== "undefined" && !store.loaded && !store.loading) {
    store.fetchSettings();
  }
  return store;
}
