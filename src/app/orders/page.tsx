import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { inr, ORDER_STATUS_LABELS, formatIST } from "@/lib/utils";
import { OrdersAutoRefresh } from "@/components/OrdersAutoRefresh";
import type { Order } from "@/lib/types";

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
      <OrdersAutoRefresh />
      <h1 className="text-xl font-extrabold">Your orders</h1>
      {orders.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No orders yet. <Link href="/" className="text-brand-700 underline">Start shopping</Link>
        </div>
      ) : (
        orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="card block p-4 hover:border-brand-300">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-gray-500">#{o.id.slice(0, 8)}</span>
              <span className="badge bg-brand-50 text-brand-700">
                {ORDER_STATUS_LABELS[o.status]}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {formatIST(o.created_at)}
              </span>
              <span className="font-bold">{inr(o.total)}</span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
