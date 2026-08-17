import { NextResponse } from "next/server";
// import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
// import { getRazorpay } from "@/lib/razorpay";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/payment/create — create a Razorpay order for an existing DB order.
//
// TEMPORARY: disabled — checkout is COD-only now, payment is resolved by the
// rider at the door instead (see /api/rider/payment/method and
// /api/webhooks/razorpay). Logic kept below, commented out, in case
// online-at-checkout comes back; see checkout/page.tsx's
// ONLINE_CHECKOUT_ENABLED.
export const POST = withApiLogging("/api/payment/create", async () => {
  return NextResponse.json(
    { error: "Online payment at checkout is currently disabled. Pay online or cash when your order arrives." },
    { status: 400 }
  );
});

// async (req: Request) => {
//   const supabase = createServerSupabase();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//
//   const { order_id } = await req.json();
//   const service = createServiceSupabase();
//
//   const { data: order, error } = await service
//     .from("orders")
//     .select("id, buyer_id, total, payment_status")
//     .eq("id", order_id)
//     .single();
//   if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
//   if (order.buyer_id !== user.id)
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   if (order.payment_status === "paid")
//     return NextResponse.json({ error: "Already paid" }, { status: 400 });
//
//   const amountPaise = Math.round(Number(order.total) * 100);
//
//   try {
//     const razorpay = getRazorpay();
//     const rzpOrder = await razorpay.orders.create({
//       amount: amountPaise,
//       currency: "INR",
//       receipt: order.id,
//     });
//
//     await service
//       .from("orders")
//       .update({ razorpay_order_id: rzpOrder.id })
//       .eq("id", order.id);
//
//     return NextResponse.json({
//       razorpay_order_id: rzpOrder.id,
//       amount: amountPaise,
//     });
//   } catch (err) {
//     return NextResponse.json({ error: (err as Error).message }, { status: 500 });
//   }
// };
