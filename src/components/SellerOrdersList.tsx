"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SellerOrderCard } from "@/components/SellerOrderCard";
import type { Order } from "@/lib/types";

type OrderItem = {
  id: string;
  order_id: string;
  name: string;
  qty: number;
  price: number;
  out_of_stock: boolean;
};

// Subscribes to Realtime changes on the seller's own orders (RLS already
// scopes this client-side query to the owning seller) and updates the list
// in place — no navigation, so no loading.tsx flash, and no polling: the
// refetch only runs when Postgres actually reports a change on a row
// belonging to this seller (or on one of their orders' items).
export function SellerOrdersList({
  sellerId,
  initialOrders,
  initialItemsByOrder,
}: {
  sellerId: string;
  initialOrders: Order[];
  initialItemsByOrder: Record<string, OrderItem[]>;
}) {
  const [list, setList] = useState<Order[]>(initialOrders);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>(initialItemsByOrder);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    async function refetch() {
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", sellerId)
        .neq("payment_status", "pending")
        .order("created_at", { ascending: false });
      const fresh = (orders as Order[]) ?? [];

      const ids = fresh.map((o) => o.id);
      const { data: allItems } = ids.length
        ? await supabase.from("order_items").select("*").in("order_id", ids)
        : { data: [] };
      const map: Record<string, OrderItem[]> = {};
      for (const it of (allItems as OrderItem[]) ?? []) {
        (map[it.order_id] ??= []).push(it);
      }

      if (alive) {
        setList(fresh);
        setItemsByOrder(map);
      }
    }

    // order_items has no seller_id column to filter on directly, so that
    // channel binds unfiltered and refetch() itself re-derives the scoped
    // set from `orders` each time — matches the pre-Realtime poll's own
    // scoping, just event-driven instead of on a timer.
    const channel = supabase
      .channel(`seller-orders-${sellerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${sellerId}` },
        refetch
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refetch)
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [sellerId]);

  return (
    <>
      <h1 className="mb-4 text-xl font-extrabold">Incoming orders ({list.length})</h1>
      {list.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No orders yet.</div>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <SellerOrderCard key={o.id} order={o as any} items={itemsByOrder[o.id] ?? []} />
          ))}
        </div>
      )}
    </>
  );
}
