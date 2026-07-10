import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { inr, ORDER_STATUS_LABELS } from "@/lib/utils";
import { OrderTimeline } from "@/components/OrderTimeline";
import type { Order, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { placed?: string };
}) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!order) notFound();
  const o = order as Order & { payment_status: string; delivery_fee: number };

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", params.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {searchParams.placed && (
        <div className="rounded-lg bg-brand-50 p-4 text-center text-brand-700">
          🎉 Order placed successfully!
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Order #{o.id.slice(0, 8)}</h1>
        <span className="badge bg-brand-50 text-brand-700">{ORDER_STATUS_LABELS[o.status]}</span>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-bold">Tracking</h2>
        <OrderTimeline orderId={o.id} initialStatus={o.status as OrderStatus} />
      </section>

      <section className="card divide-y">
        {(items ?? []).map((it: { id: string; name: string; qty: number; price: number }) => (
          <div key={it.id} className="flex justify-between p-3 text-sm">
            <span>{it.name} × {it.qty}</span>
            <span className="font-medium">{inr(it.price * it.qty)}</span>
          </div>
        ))}
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
        <div className="flex justify-between"><span>Delivery fee</span><span>{inr(o.delivery_fee)}</span></div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span><span>{inr(o.total)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Payment</span>
          <span className="uppercase">{o.payment_status}</span>
        </div>
      </section>

      <Link href="/orders" className="btn-outline w-full">Back to orders</Link>
    </div>
  );
}
