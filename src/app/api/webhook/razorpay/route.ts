import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { getRazorpay, verifyPaymentSignature, validateWebhookSignature } from "@/lib/razorpay";
import { withApiLogging } from "@/lib/apiLogger";
import crypto from "crypto";

export const POST = withApiLogging("/api/webhook/razorpay", async (req: Request) => {
  const service = createServiceSupabase();

  // Get raw body for signature verification
  const rawBody = await req.text();
  
  // Validate webhook signature
  const webhookSignature = req.headers.get("x-razorpay-signature");
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  if (webhookSecret && webhookSignature) {
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    
    // Constant-time comparison
    const a = Buffer.from(expectedSignature);
    const b = Buffer.from(webhookSignature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error("[webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else if (webhookSecret) {
    console.warn("[webhook] Missing signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Idempotency check using x-razorpay-event-id
  const eventId = req.headers.get("x-razorpay-event-id");
  if (eventId) {
    const { data: existing } = await service
      .from("webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .single();
    
    if (existing) {
      console.log(`[webhook] Duplicate event ignored: ${eventId}`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    
    // Store event ID
    await service
      .from("webhook_events")
      .insert({ event_id: eventId, created_at: new Date().toISOString() });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event;

  // Handle delivery payment (buyer pays via UPI QR)
  if (event === "payment.captured") {
    const payment = body.payload.payment.entity;
    const orderId = payment.notes?.order_id;
    const type = payment.notes?.type;

    if (type === "delivery_payment" && orderId) {
      // Verify this is a valid delivery payment
      const { data: order } = await service
        .from("orders")
        .select("id, razorpay_delivery_order_id, total, subtotal, delivery_fee, other_charges, payment_status")
        .eq("id", orderId)
        .single();

      if (order && order.razorpay_delivery_order_id === payment.order_id) {
        // Mark delivery payment as paid
        await service
          .from("orders")
          .update({
            delivery_payment_status: "paid",
            razorpay_delivery_payment_id: payment.id,
            payment_status: "paid",
          })
          .eq("id", orderId);

        // For COD orders paid via UPI: rider keeps delivery_fee, owes (subtotal + other_charges) to platform
        const remittanceDue = order.payment_status === "cod"
          ? order.subtotal + order.other_charges
          : 0;

        if (remittanceDue > 0) {
          await service
            .from("orders")
            .update({
              rider_remittance_due: remittanceDue,
              rider_remittance_status: "pending",
            })
            .eq("id", orderId);
        }

        console.log(`[webhook] Delivery payment captured for order ${orderId}`);
      }
    }

    // Handle rider remittance payment (rider pays platform their due)
    if (type === "rider_remittance" && orderId) {
      const { data: order } = await service
        .from("orders")
        .select("id, razorpay_remittance_order_id, rider_remittance_due")
        .eq("id", orderId)
        .single();

      if (order && order.razorpay_remittance_order_id === payment.order_id) {
        await service
          .from("orders")
          .update({
            rider_remittance_status: "paid",
            razorpay_remittance_payment_id: payment.id,
          })
          .eq("id", orderId);

        console.log(`[webhook] Rider remittance captured for order ${orderId}`);
      }
    }
  }

  // Handle payment failed
  if (event === "payment.failed") {
    const payment = body.payload.payment.entity;
    const orderId = payment.notes?.order_id;
    const type = payment.notes?.type;

    if (type === "delivery_payment" && orderId) {
      await service
        .from("orders")
        .update({ delivery_payment_status: "failed" })
        .eq("id", orderId);
    }
    if (type === "rider_remittance" && orderId) {
      await service
        .from("orders")
        .update({ rider_remittance_status: "failed" })
        .eq("id", orderId);
    }
  }

  return NextResponse.json({ received: true });
});