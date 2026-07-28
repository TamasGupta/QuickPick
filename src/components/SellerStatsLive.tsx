"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inr } from "@/lib/utils";

interface Stats {
  productCount: number;
  orderCount: number;
  revenue: number;
  pending: number;
}

// Subscribes to Realtime changes on the seller's own products/orders (RLS
// already scopes these client-side queries to the owning seller) and
// recomputes the numbers in place — no navigation, so no loading.tsx flash,
// and no polling: this only recomputes when Postgres reports an actual
// change on a row belonging to this seller.
export function SellerStatsLive({
  sellerId,
  storeStatus,
  initial,
}: {
  sellerId: string;
  storeStatus: string;
  initial: Stats;
}) {
  const [stats, setStats] = useState<Stats>(initial);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    async function refresh() {
      const [{ count: productCount }, { data: orders }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("seller_id", sellerId),
        supabase.from("orders").select("total, status").eq("seller_id", sellerId).neq("payment_status", "pending"),
      ]);
      const revenue = (orders ?? [])
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + Number(o.total), 0);
      const pending = (orders ?? []).filter((o) => ["placed", "accepted", "packed"].includes(o.status)).length;
      if (alive) {
        setStats({ productCount: productCount ?? 0, orderCount: orders?.length ?? 0, revenue, pending });
      }
    }

    const channel = supabase
      .channel(`seller-stats-${sellerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${sellerId}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `seller_id=eq.${sellerId}` },
        refresh
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [sellerId]);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Products" value={String(stats.productCount)} />
        <Stat label="Orders" value={String(stats.orderCount)} />
        <Stat label="Revenue" value={inr(stats.revenue)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Pending orders" value={String(stats.pending)} />
        <Stat label="Store status" value={storeStatus} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
