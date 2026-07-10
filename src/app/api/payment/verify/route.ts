import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { verifyPaymentSignature } from "@/lib/razorpay";

// POST /api/payment/verify — verify Razorpay signature, mark order paid,
// and atomically decrement stock. Server-side signature check is the
// security boundary; never trust the client's "success".
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    await req.json();

  const ok = verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const service = createServiceSupabase();

  // Confirm this order belongs to the user and matches the razorpay order.
  const { data: order } = await service
    .from("orders")
    .select("id, buyer_id, razorpay_order_id, payment_status")
    .eq("id", order_id)
    .single();
  if (!order || order.buyer_id !== user.id || order.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: true }); // idempotent
  }

  // Decrement stock first; if it fails (oversold), don't mark paid.
  const { error: stockErr } = await service.rpc("decrement_stock", {
    p_order_id: order.id,
  });
  if (stockErr) {
    return NextResponse.json(
      { error: "Stock unavailable — payment will be refunded." },
      { status: 409 }
    );
  }

  await service
    .from("orders")
    .update({
      payment_status: "paid",
      razorpay_payment_id,
      status: "placed",
    })
    .eq("id", order.id);

  return NextResponse.json({ ok: true });
}
