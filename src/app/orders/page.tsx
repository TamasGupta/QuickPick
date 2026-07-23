import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { BuyerOrdersList } from "@/components/BuyerOrdersList";
import type { Metadata } from "next";
import type { Order } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your Orders",
  description: "Track and manage all your GrabOn grocery orders in one place.",
};

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });
  const orders = (data as Order[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-extrabold">Your orders</h1>
      <BuyerOrdersList userId={user.id} initialOrders={orders} />
    </div>
  );
}
