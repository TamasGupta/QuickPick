import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { inr } from "@/lib/utils";
import { OrderStatusLive } from "@/components/OrderStatusLive";
import { LottieIcon } from "@/components/LottieIcon";
import type { Order, Address } from "@/lib/types";

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

  const { data: order } = await supabase.from("orders").select("*").eq("id", params.id).single();
  if (!order) notFound();
  const o = order as Order & { payment_status: string; delivery_fee: number; address_id: string | null };

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", params.id);

  // Delivery address + assigned rider (rider name via service client — RLS keeps
  // other profiles private).
  const service = createServiceSupabase();
  const [{ data: addr }, riderRes] = await Promise.all([
    o.address_id
      ? supabase.from("addresses").select("*").eq("id", o.address_id).single()
      : Promise.resolve({ data: null }),
    o.rider_id
      ? service.from("profiles").select("full_name, phone").eq("id", o.rider_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const address = addr as Address | null;
  const rider = riderRes.data as { full_name: string | null; phone: string | null } | null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {searchParams.placed && (
        <div className="animate-fade-in flex flex-col items-center rounded-2xl bg-brand-50 p-2 text-center font-semibold text-brand-700">
          <LottieIcon name="cart-check" loop={false} className="h-24 w-24" />
          <p className="-mt-2">Order placed successfully!</p>
        </div>
      )}

      <OrderStatusLive
        orderId={o.id}
        orderIdShort={o.id.slice(0, 8)}
        initial={{ status: o.status, delivery_otp: o.delivery_otp ?? null, rider }}
      />

      {address && (
        <section className="card flex items-start gap-2 p-4">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
          <div className="text-sm">
            <p className="font-semibold text-ink">Delivering to {address.label}</p>
            <p className="text-ink-soft">
              {[address.line1, address.line2, address.city, address.pincode].filter(Boolean).join(", ")}
            </p>
          </div>
        </section>
      )}

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
