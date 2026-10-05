import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { withApiLogging } from "@/lib/apiLogger";

export const GET = withApiLogging("/api/rider/delivery-payment-status", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId) return NextResponse.json({ error: "order_id required" }, { status: 400 });

  const service = createServiceSupabase();

  const { data: order, error } = await service
    .from("orders")
    .select("id, rider_id, payment_mode, delivery_payment_status, razorpay_delivery_order_id, razorpay_delivery_payment_id, delivery_qr_id, total, subtotal, delivery_fee, other_charges, rider_remittance_due, rider_remittance_status, razorpay_remittance_order_id")
    .eq("id", orderId)
    .single();

  if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.rider_id !== user.id) return NextResponse.json({ error: "Not your order" }, { status: 403 });

  // Fallback: if webhook hasn't confirmed yet, check Razorpay directly.
  if (order.delivery_payment_status !== "paid") {
    try {
      const { getRazorpay } = await import("@/lib/razorpay");
      const rzp = getRazorpay();
      let captured: any = null;
      if (order.delivery_qr_id) {
        const res: any = await new Promise((resolve, reject) => {
          (rzp as any).qrCode.fetchAllPayments(order.delivery_qr_id, {}, (err: any, data: any) =>
            err ? reject(err) : resolve(data)
          );
        });
        captured = res?.items?.find((p: any) => p.status === "captured");
      }
      if (!captured && order.razorpay_delivery_order_id) {
        const res: any = await (rzp as any).orders.fetchPayments(order.razorpay_delivery_order_id);
        captured = res?.items?.find((p: any) => p.status === "captured");
      }
      if (captured) {
        await service
          .from("orders")
          .update({
            delivery_payment_status: "paid",
            razorpay_delivery_payment_id: captured.id,
            payment_status: "paid",
          })
          .eq("id", order.id);
        order.delivery_payment_status = "paid";
        order.razorpay_delivery_payment_id = captured.id;
      }
    } catch (e) {
      console.error("[delivery-payment-status] Razorpay fallback check failed:", e);
    }
  }

  return NextResponse.json({
    payment_mode: order.payment_mode,
    delivery_payment_status: order.delivery_payment_status,
    razorpay_delivery_order_id: order.razorpay_delivery_order_id,
    razorpay_delivery_payment_id: order.razorpay_delivery_payment_id,
    total: order.total,
    subtotal: order.subtotal,
    delivery_fee: order.delivery_fee,
    other_charges: order.other_charges,
    rider_remittance_due: order.rider_remittance_due,
    rider_remittance_status: order.rider_remittance_status,
    razorpay_remittance_order_id: order.razorpay_remittance_order_id,
  });
});