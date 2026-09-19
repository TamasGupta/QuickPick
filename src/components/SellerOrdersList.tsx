"use client";

import { useEffect, useState } from "react";
import { SellerOrderCard } from "@/components/SellerOrderCard";
import type { Order } from "@/lib/types";

type OrderItem = {
  id: string;
  order_id: string;
  name: string;
  qty: number;
  price: number;
  out_of_stock: boolean;
  unit?: string;
};

// Subscribes to Realtime changes on the seller's own orders and updates the list
// in place — no navigation, so no loading.tsx flash, and no polling.
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
    let alive = true;
    async function refetch() {
      const res = await fetch("/api/seller/orders");
      if (!res.ok) return;
      const { orders, itemsByOrder } = await res.json();
      if (alive) {
        setList(orders);
        setItemsByOrder(itemsByOrder);
      }
    }

    const { createClient } = require("@/lib/supabase/client");
    const supabase = createClient();
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