import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { withApiLogging } from "@/lib/apiLogger";
import { sendPushToUser } from "@/lib/push";

// POST /api/payment/verify — verify Razorpay signature, mark order paid,
// and atomically decrement stock. Server-side signature check is the
// security boundary; never trust the client's "success".
export const POST = withApiLogging("/api/payment/verify", async (req: Request) => {
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
    .select("id, buyer_id, razorpay_order_id, payment_status, seller_id, total")
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

  // This is the moment an online order actually becomes real/actionable for
  // the seller — the row existed before this with payment_status "pending",
  // which SellerNav's badge count (and the /api/orders COD-only push hook)
  // both deliberately exclude.
  const { data: seller } = await service.from("sellers").select("owner_id").eq("id", order.seller_id).single();
  if (seller?.owner_id) {
    void sendPushToUser(seller.owner_id, {
      title: "New order received",
      body: `A new order worth ${order.total} is waiting to be accepted.`,
      url: "/seller/orders",
      tag: `order-${order.id}`,
    });
  }

  return NextResponse.json({ ok: true });
});
