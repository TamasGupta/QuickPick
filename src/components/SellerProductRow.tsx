"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inr } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function SellerProductRow({ product }: { product: Product }) {
  const supabase = createClient();
  const [price, setPrice] = useState(product.price);
  const [stock, setStock] = useState(product.stock);
  const [active, setActive] = useState(product.is_active);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function save() {
    setSaving(true);
    await supabase
      .from("products")
      .update({ price, stock, is_active: active })
      .eq("id", product.id);
    setSaving(false);
    setDirty(false);
  }

  async function toggle() {
    const next = !active;
    setActive(next);
    await supabase.from("products").update({ is_active: next }).eq("id", product.id);
  }

  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="h-full w-full rounded-lg object-cover" />
        ) : (
          "🛍️"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="text-xs text-gray-500">{product.brand} · {product.unit}</p>
      </div>
      <label className="text-xs text-gray-500">
        Price
        <input
          type="number"
          value={price}
          onChange={(e) => { setPrice(Number(e.target.value)); setDirty(true); }}
          className="ml-1 w-20 rounded border px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs text-gray-500">
        Stock
        <input
          type="number"
          value={stock}
          onChange={(e) => { setStock(Number(e.target.value)); setDirty(true); }}
          className="ml-1 w-16 rounded border px-2 py-1 text-sm"
        />
      </label>
      <button
        onClick={toggle}
        className={`badge ${active ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-500"}`}
      >
        {active ? "Active" : "Hidden"}
      </button>
      {dirty && (
        <button className="btn-primary py-1" disabled={saving} onClick={save}>
          {saving ? "…" : "Save"}
        </button>
      )}
    </div>
  );
}
