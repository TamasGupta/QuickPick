"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { inr, ORDER_STATUS_LABELS, formatIST } from "@/lib/utils";
import type { Order } from "@/lib/types";

// Polls the buyer's own orders (RLS already scopes this client-side query to
// buyer_id = auth.uid()) and updates the list in place — no navigation, so no
// loading.tsx flash between polls, unlike a router.refresh()-driven approach.
export function BuyerOrdersList({ userId, initialOrders }: { userId: string; initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    async function poll() {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });
      if (alive && data) setOrders(data as Order[]);
    }
    const id = setInterval(poll, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [userId]);

  if (orders.length === 0) {
    return (
      <div className="card p-8 text-center text-gray-500">
        No orders yet. <Link href="/" className="text-brand-700 underline">Start shopping</Link>
      </div>
    );
  }

  return (
    <>
      {orders.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="card block p-4 hover:border-brand-300">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-gray-500">#{o.id.slice(0, 8)}</span>
            <span className="badge bg-brand-50 text-brand-700">{ORDER_STATUS_LABELS[o.status]}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-gray-500">{formatIST(o.created_at)}</span>
            <span className="font-bold">{inr(o.total)}</span>
          </div>
        </Link>
      ))}
    </>
  );
}
