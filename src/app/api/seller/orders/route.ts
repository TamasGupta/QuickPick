import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";
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

export const GET = withApiLogging("/api/seller/orders", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: seller } = await supabase
    .from("sellers")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!seller) return NextResponse.json({ error: "No seller store found" }, { status: 404 });

  const service = createServiceSupabase();

  const { data: orders, error: ordersError } = await service
    .from("orders")
    .select("*")
    .eq("seller_id", seller.id)
    .neq("payment_status", "pending")
    .order("created_at", { ascending: false });

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  const list = (orders as Order[]) ?? [];
  const ids = list.map((o) => o.id);

  const { data: allItems, error: itemsError } = ids.length
    ? await service.from("order_items").select("*").in("order_id", ids)
    : { data: [], error: null };

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const itemsByOrder: Record<string, OrderItem[]> = {};
  for (const it of (allItems as OrderItem[]) ?? []) {
    (itemsByOrder[it.order_id] ??= []).push(it);
  }

  return NextResponse.json({ orders: list, itemsByOrder });
});