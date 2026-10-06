import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { getRazorpay } from "@/lib/razorpay";
import { withApiLogging } from "@/lib/apiLogger";

export const POST = withApiLogging("/api/rider/create-delivery-payment", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("[create-delivery-payment] Auth user:", user?.id, user?.email);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  
  const isRider = await requireRider(supabase, user);
  console.log("[create-delivery-payment] Is rider:", isRider, "user.id:", user.id);
  if (!isRider) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const { order_id, payment_mode } = await req.json();
  console.log("[create-delivery-payment] Request:", { order_id, payment_mode });
  if (!order_id || !payment_mode) {
    return NextResponse.json({ error: "order_id and payment_mode required" }, { status: 400 });
  }
  if (!["cash", "upi"].includes(payment_mode)) {
    return NextResponse.json({ error: "Invalid payment_mode" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Fetch order details
  const { data: order, error: orderErr } = await service
    .from("orders")
    .select("id, rider_id, status, payment_status, total, subtotal, delivery_fee, other_charges, razorpay_delivery_order_id")
    .eq("id", order_id)
    .single();

  console.log("[create-delivery-payment] Order fetch:", { order: order?.id, orderErr: orderErr?.message, riderId: order?.rider_id, userId: user.id, status: order?.status });
  if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.rider_id !== user.id) return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (order.status !== "out_for_delivery") return NextResponse.json({ error: "Order not out for delivery", status: order.status }, { status: 409 });

  // For UPI: create Razorpay order for buyer to scan
  if (payment_mode === "upi") {
    if (order.razorpay_delivery_order_id) {
      // Reuse existing order
      console.log("[create-delivery-payment] Reusing existing Razorpay order:", order.razorpay_delivery_order_id);
      const rzp = getRazorpay();
      try {
        const rzpOrder = await rzp.orders.fetch(order.razorpay_delivery_order_id);
        return NextResponse.json({
          razorpay_order_id: rzpOrder.id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
        });
      } catch (err: any) {
        console.error("[create-delivery-payment] Failed to fetch existing Razorpay order:", JSON.stringify(err?.error ?? err));
        return NextResponse.json({ error: err?.error?.description ?? "Failed to fetch Razorpay order" }, { status: 500 });
      }
    }

    console.log("[create-delivery-payment] Creating new Razorpay order for amount:", order.total);
    const rzp = getRazorpay();
    const amountPaise = Math.round(order.total * 100);
    let rzpOrder;
    try {
      rzpOrder = await rzp.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `delivery_${order_id.slice(0, 8)}`,
        notes: {
          order_id,
          type: "delivery_payment",
          payment_mode: "upi",
        },
      });
    } catch (err: any) {
      console.error("[create-delivery-payment] Failed to create Razorpay order:", JSON.stringify(err?.error ?? err));
      return NextResponse.json({ error: err?.error?.description ?? "Failed to create Razorpay order" }, { status: 500 });
    }
    console.log("[create-delivery-payment] Razorpay order created:", rzpOrder.id);

    await service
      .from("orders")
      .update({
        payment_mode: "upi",
        razorpay_delivery_order_id: rzpOrder.id,
        delivery_payment_status: "pending",
      })
      .eq("id", order_id);

    return NextResponse.json({
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  }

  // For cash: just update payment_mode, delivery will complete on OTP
  await service
    .from("orders")
    .update({ payment_mode: "cash" })
    .eq("id", order_id);

  return NextResponse.json({ ok: true, payment_mode: "cash" });
});