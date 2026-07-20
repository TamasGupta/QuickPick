"use client";

import { useMemo, useState } from "react";
import { Search, Pencil } from "lucide-react";
import { inr } from "@/lib/utils";
import { ProductEditModal } from "@/components/ProductEditModal";
import type { Product } from "@/lib/types";

type Row = Product & { sellers: { store_name: string } | null };

export function AdminProductsTable({ products: initial }: { products: Row[] }) {
  const [products, setProducts] = useState(initial);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.sellers?.store_name.toLowerCase().includes(query)
    );
  }, [products, q]);

  function handleSaved(updated: Product) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          className="input pl-10"
          placeholder="Search by product, brand, or store…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card divide-y">
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg opacity-60">🛍️</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{p.name}</p>
              <p className="truncate text-xs text-ink-faint">
                {p.sellers?.store_name ?? "Unknown store"}
                {p.brand && ` · ${p.brand}`}
                {p.unit && ` · ${p.unit}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-ink">{inr(p.price)}</p>
              <p className="text-xs text-ink-faint">Stock {p.stock}</p>
            </div>
            <span
              className={`badge shrink-0 ${
                !p.is_active
                  ? "bg-gray-100 text-gray-500"
                  : p.stock <= 0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-brand-50 text-brand-700"
              }`}
            >
              {!p.is_active ? "Hidden" : p.stock <= 0 ? "Out of stock" : "Active"}
            </span>
            <button className="btn-ghost shrink-0 p-1.5" onClick={() => setEditing(p)} aria-label="Edit product">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">
            {products.length === 0 ? "No products listed yet." : "No products match your search."}
          </p>
        )}
      </div>

      {editing && (
        <ProductEditModal product={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
