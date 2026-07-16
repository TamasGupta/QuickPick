"use client";

import { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import type { Product } from "@/lib/types";

export function ProductGrid({
  initialProducts,
  initialNextCursor,
  q,
  catSlug,
}: {
  initialProducts: Product[];
  initialNextCursor: string | null;
  q?: string;
  catSlug?: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [cursor, setCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function loadMore() {
    if (loading || !cursor) return;
    setLoading(true);
    const params = new URLSearchParams({ cursor });
    if (q) params.set("q", q);
    if (catSlug) params.set("cat", catSlug);
    const res = await fetch(`/api/products?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setProducts((prev) => [...prev, ...json.products]);
      setCursor(json.nextCursor);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!cursor) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" } // start fetching well before the sentinel is visible
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  return (
    <>
      <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
        {loading &&
          Array.from({ length: 6 }).map((_, i) => <ProductSkeleton key={`skeleton-${i}`} />)}
      </div>
      {cursor && <div ref={sentinelRef} className="h-1" aria-hidden />}
    </>
  );
}
