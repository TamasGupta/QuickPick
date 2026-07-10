import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { SellerOrderCard } from "@/components/SellerOrderCard";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SellerOrdersPage() {
  const { user, seller } = await getMySeller();
  if (!user) redirect("/login");
  if (!seller) redirect("/seller");

  const supabase = createServerSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });

  const list = (orders as Order[]) ?? [];

  // Fetch items for all orders in one query.
  const ids = list.map((o) => o.id);
  const { data: allItems } = ids.length
    ? await supabase.from("order_items").select("*").in("order_id", ids)
    : { data: [] };
  const itemsByOrder = new Map<string, any[]>();
  for (const it of allItems ?? []) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }

  return (
    <div>
      <SellerNav />
      <h1 className="mb-4 text-xl font-extrabold">Incoming orders ({list.length})</h1>
      {list.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No orders yet.</div>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <SellerOrderCard
              key={o.id}
              order={o as any}
              items={itemsByOrder.get(o.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
