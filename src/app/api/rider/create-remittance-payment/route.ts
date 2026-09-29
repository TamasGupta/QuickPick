import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { getRazorpay } from "@/lib/razorpay";
import { withApiLogging } from "@/lib/apiLogger";

export const POST = withApiLogging("/api/rider/create-remittance-payment", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const { order_id } = await req.json();
  if (!order_id) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { data: order, error } = await service
    .from("orders")
    .select("id, rider_id, rider_remittance_due, rider_remittance_status, razorpay_remittance_order_id, total, subtotal, delivery_fee, other_charges, payment_status")
    .eq("id", order_id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.rider_id !== user.id) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (order.rider_remittance_status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 409 });
  if (!order.rider_remittance_due || order.rider_remittance_due <= 0) {
    return NextResponse.json({ error: "No remittance due" }, { status: 409 });
  }

  // Reuse existing Razorpay order if exists
  if (order.razorpay_remittance_order_id) {
    const rzp = getRazorpay();
    const rzpOrder = await rzp.orders.fetch(order.razorpay_remittance_order_id);
    return NextResponse.json({
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      remittance_due: order.rider_remittance_due,
    });
  }

  const rzp = getRazorpay();
  const amountPaise = Math.round(order.rider_remittance_due * 100);
  const rzpOrder = await rzp.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `remit_${order_id.slice(0, 8)}`,
    notes: {
      order_id,
      type: "rider_remittance",
    },
  });

  await service
    .from("orders")
    .update({ razorpay_remittance_order_id: rzpOrder.id })
    .eq("id", order_id);

  return NextResponse.json({
    razorpay_order_id: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    remittance_due: order.rider_remittance_due,
  });
});