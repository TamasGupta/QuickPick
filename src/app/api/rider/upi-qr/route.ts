import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { getRazorpay } from "@/lib/razorpay";
import { withApiLogging } from "@/lib/apiLogger";

export const GET = withApiLogging("/api/rider/upi-qr", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order_id");
  const keyId = searchParams.get("key_id");

  if (!orderId || !keyId) {
    return NextResponse.json({ error: "order_id and key_id required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify order belongs to rider (orderId is the Razorpay order ID)
  const { data: order } = await service
    .from("orders")
    .select("id, razorpay_delivery_order_id, rider_id, total")
    .eq("razorpay_delivery_order_id", orderId)
    .single();

  if (!order || order.rider_id !== user.id) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }

  try {
    const rzp = getRazorpay();
    
    // Fetch the Razorpay order to get amount
    const rzpOrder = await rzp.orders.fetch(orderId);
    const amount = Number(rzpOrder.amount);
    
    // Create a QR code using Razorpay's QR Code API
    const qr = await new Promise<any>((resolve, reject) => {
      rzp.qrCode.create({
        type: "upi_qr",
        name: `Delivery Payment ${orderId.slice(0, 8)}`,
        usage: "single_use",
        fixed_amount: true,
        payment_amount: amount,
        description: "COD delivery payment",
        close_by: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
        notes: {
          order_id: order.id,
          type: "delivery_payment",
          razorpay_order_id: orderId,
        },
      }, (err: any, data: any) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    await service
      .from("orders")
      .update({ delivery_qr_id: qr.id })
      .eq("id", order.id);

    return NextResponse.json({
      qr_url: qr.image_url,
      qr_id: qr.id,
    });
  } catch (err: any) {
    console.error("[upi-qr] Razorpay QR creation failed:", err);
    const message = err?.error?.description || err?.message || "Failed to generate QR code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});