import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { withApiLogging } from "@/lib/apiLogger";
import { createDeliveryQr, closeDeliveryQr, fetchDeliveryQr, razorpayErrorMessage } from "@/lib/razorpay";

// POST /api/rider/payment/method — the rider records how the buyer is
// paying at the door once they arrive:
//   "cash"   — buyer hands over cash directly. payment_status stays 'cod';
//              settled via a ledger entry once delivered (rider now owes
//              the seller + platform their shares — see
//              /api/rider/[action]'s deliver branch).
//   "online" — generates a Razorpay QR the rider shows the buyer to scan.
//              Confirmed later by /api/webhooks/razorpay (a webhook, not
//              this route) flipping payment_status to 'paid'.
export const POST = withApiLogging("/api/rider/payment/method", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const { order_id, method } = (await req.json().catch(() => ({}))) as {
    order_id?: string;
    method?: "cash" | "online";
  };
  if (!order_id || (method !== "cash" && method !== "online")) {
    return NextResponse.json({ error: "order_id and a valid method are required" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data: order } = await service
    .from("orders")
    .select("id, rider_id, status, payment_status, total, razorpay_qr_id")
    .eq("id", order_id)
    .single();
  if (!order || order.rider_id !== user.id || order.status !== "out_for_delivery") {
    return NextResponse.json({ error: "Cannot set payment method for this order" }, { status: 409 });
  }
  if (order.payment_status !== "cod") {
    // Already paid (e.g. the webhook landed between page loads) — nothing
    // left to choose.
    return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
  }

  if (method === "cash") {
    // Switching away from a QR that was already shown — close it so a late
    // scan can't still succeed after the rider's moved on to cash.
    if (order.razorpay_qr_id) void closeDeliveryQr(order.razorpay_qr_id);
    await service
      .from("orders")
      .update({ delivery_payment_method: "cash", razorpay_qr_id: null })
      .eq("id", order.id);
    return NextResponse.json({ ok: true, method: "cash" });
  }

  // method === "online"
  if (order.razorpay_qr_id) {
    // Already generated for this order (e.g. rider reopened the card) —
    // redisplay it instead of creating a duplicate collectible.
    try {
      const existing = await fetchDeliveryQr(order.razorpay_qr_id);
      if (existing.status === "active") {
        return NextResponse.json({ ok: true, method: "online", qr_id: existing.id, image_url: existing.image_url });
      }
      // Closed/expired — fall through and create a fresh one below.
    } catch {
      // Fetch failed — fall through and create a fresh one below.
    }
  }

  try {
    const qr = await createDeliveryQr({
      orderId: order.id,
      amountPaise: Math.round(Number(order.total) * 100),
    });
    await service
      .from("orders")
      .update({ delivery_payment_method: "online", razorpay_qr_id: qr.id })
      .eq("id", order.id);
    return NextResponse.json({ ok: true, method: "online", qr_id: qr.id, image_url: qr.image_url });
  } catch (err) {
    return NextResponse.json({ error: razorpayErrorMessage(err) }, { status: 500 });
  }
});
