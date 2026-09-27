import { redirect } from "next/navigation";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { SellerOrdersList } from "@/components/SellerOrdersList";
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
    // Unpaid online-payment attempts (abandoned Razorpay checkout) are not
    // real orders yet — don't surface them for the seller to prepare.
    .neq("payment_status", "pending")
    .order("created_at", { ascending: false });

  const list = (orders as Order[]) ?? [];

  // Fetch items for all orders using service role (bypasses RLS since we already
  // verified the seller owns these orders via the orders query above).
  const service = createServiceSupabase();
  const ids = list.map((o) => o.id);
  const { data: allItems } = ids.length
    ? await service.from("order_items").select("*").in("order_id", ids)
    : { data: [] };
  const itemsByOrder: Record<string, any[]> = {};
  for (const it of allItems ?? []) {
    (itemsByOrder[it.order_id] ??= []).push(it);
  }

  return (
    <div>
      <SellerNav />
      <SellerOrdersList sellerId={seller.id} initialOrders={list} initialItemsByOrder={itemsByOrder} />
    </div>
  );
}
