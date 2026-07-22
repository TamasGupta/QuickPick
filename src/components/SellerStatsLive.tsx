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

// Polls the seller's own product/order counts (RLS already scopes this
// client-side query to the owning seller) and updates the numbers in place —
// no navigation, so no loading.tsx flash between polls.
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
    async function poll() {
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
    const id = setInterval(poll, 15000);
    return () => {
      alive = false;
      clearInterval(id);
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
