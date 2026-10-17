"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { SellerProductRow } from "@/components/SellerProductRow";
import type { Product } from "@/lib/types";

export function SellerProductsList({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
    );
  }, [products, q]);

  function handleDelete(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUpdate(updated: Product) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">
          Products ({products.length})
          {q.trim() && filtered.length !== products.length && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filtered.length} matching)
            </span>
          )}
        </h1>
        <Link href="/seller/upload" className="btn-primary">
          + Bulk upload
        </Link>
      </div>

      {products.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            className="input pl-10"
            placeholder="Search products by name, brand, or SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      {products.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No products yet.{" "}
          <Link href="/seller/upload" className="text-brand-700 underline">
            Upload a file
          </Link>{" "}
          to add your catalog.
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No products match &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="card divide-y">
          {filtered.map((p) => (
            <SellerProductRow
              key={p.id}
              product={p}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
