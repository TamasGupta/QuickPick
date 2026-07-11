import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, ShieldCheck, Bike, Phone } from "lucide-react";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { inr, ORDER_STATUS_LABELS } from "@/lib/utils";
import { OrderTimeline } from "@/components/OrderTimeline";
import type { Order, OrderStatus, Address } from "@/lib/types";

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

  const active = o.status !== "delivered" && o.status !== "cancelled";
  const showOtp = active && o.delivery_otp && o.status !== "placed";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {searchParams.placed && (
        <div className="animate-fade-in rounded-2xl bg-brand-50 p-4 text-center font-semibold text-brand-700">
          🎉 Order placed successfully!
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Order #{o.id.slice(0, 8)}</h1>
        <span className="badge bg-brand-50 text-brand-700">{ORDER_STATUS_LABELS[o.status]}</span>
      </div>

      {/* Delivery OTP */}
      {showOtp && (
        <section className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 p-4">
          <ShieldCheck className="h-8 w-8 shrink-0 text-brand-600" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Delivery OTP
            </p>
            <p className="text-3xl font-extrabold tracking-[0.35em] text-ink">{o.delivery_otp}</p>
            <p className="text-xs text-ink-soft">Share this with your delivery partner at handover.</p>
          </div>
        </section>
      )}

      {/* Rider */}
      {rider && active && (
        <section className="card flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Bike className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{rider.full_name ?? "Delivery partner"}</p>
              <p className="text-xs text-ink-faint">Your delivery partner</p>
            </div>
          </div>
          {rider.phone && (
            <a href={`tel:${rider.phone}`} className="btn-outline">
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-3 font-bold">Tracking</h2>
        <OrderTimeline orderId={o.id} initialStatus={o.status as OrderStatus} />
      </section>

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
