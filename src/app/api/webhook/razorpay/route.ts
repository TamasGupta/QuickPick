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

  // Handle delivery payment and rider remittance success
  const isPaymentSuccess =
    event === "payment.captured" ||
    event === "qr_code.credited" ||
    event === "order.paid";

  if (isPaymentSuccess) {
    const payment = body.payload?.payment?.entity;
    const qrEntity = body.payload?.qr_code?.entity;
    const orderEntity = body.payload?.order?.entity;

    const notes = {
      ...(orderEntity?.notes ?? {}),
      ...(qrEntity?.notes ?? {}),
      ...(payment?.notes ?? {}),
    };

    const orderId = notes.order_id;
    const type = notes.type;
    const qrCodeId = payment?.qr_code_id ?? qrEntity?.id;
    const rzpOrderId = payment?.order_id ?? orderEntity?.id ?? notes.razorpay_order_id;

    // 1. Delivery Payment (buyer pays via UPI QR)
    let order: any = null;

    if (orderId) {
      const { data } = await service
        .from("orders")
        .select("id, razorpay_delivery_order_id, delivery_qr_id, total, subtotal, delivery_fee, other_charges, payment_status, delivery_payment_status")
        .eq("id", orderId)
        .single();
      order = data;
    }

    if (!order && qrCodeId) {
      const { data } = await service
        .from("orders")
        .select("id, razorpay_delivery_order_id, delivery_qr_id, total, subtotal, delivery_fee, other_charges, payment_status, delivery_payment_status")
        .eq("delivery_qr_id", qrCodeId)
        .single();
      order = data;
    }

    if (!order && rzpOrderId) {
      const { data } = await service
        .from("orders")
        .select("id, razorpay_delivery_order_id, delivery_qr_id, total, subtotal, delivery_fee, other_charges, payment_status, delivery_payment_status")
        .eq("razorpay_delivery_order_id", rzpOrderId)
        .single();
      order = data;
    }

    if (order) {
      const isDeliveryPayment =
        type === "delivery_payment" ||
        (qrCodeId && order.delivery_qr_id === qrCodeId) ||
        (rzpOrderId && order.razorpay_delivery_order_id === rzpOrderId);

      if (isDeliveryPayment) {
        await service
          .from("orders")
          .update({
            delivery_payment_status: "paid",
            razorpay_delivery_payment_id: payment?.id ?? null,
            payment_status: "paid",
            payment_mode: "upi",
          })
          .eq("id", order.id);

        console.log(`[webhook] Delivery payment confirmed as paid for order ${order.id}`);
      }
    }

    // 2. Rider remittance payment (rider pays platform their cash dues)
    if (type === "rider_remittance" || (rzpOrderId && !order)) {
      let remitOrder: any = null;
      if (orderId) {
        const { data } = await service
          .from("orders")
          .select("id, razorpay_remittance_order_id, rider_remittance_due")
          .eq("id", orderId)
          .single();
        remitOrder = data;
      }
      if (!remitOrder && rzpOrderId) {
        const { data } = await service
          .from("orders")
          .select("id, razorpay_remittance_order_id, rider_remittance_due")
          .eq("razorpay_remittance_order_id", rzpOrderId)
          .single();
        remitOrder = data;
      }

      if (remitOrder && (remitOrder.razorpay_remittance_order_id === rzpOrderId || remitOrder.razorpay_remittance_order_id === payment?.order_id)) {
        await service
          .from("orders")
          .update({
            rider_remittance_status: "paid",
            razorpay_remittance_payment_id: payment?.id ?? null,
          })
          .eq("id", remitOrder.id);

        console.log(`[webhook] Rider remittance captured for order ${remitOrder.id}`);
      }
    }
  }

  // Handle payment failed
  if (event === "payment.failed") {
    const payment = body.payload?.payment?.entity;
    const qrEntity = body.payload?.qr_code?.entity;
    const notes = { ...(qrEntity?.notes ?? {}), ...(payment?.notes ?? {}) };
    const orderId = notes.order_id;
    const type = notes.type;
    const qrCodeId = payment?.qr_code_id ?? qrEntity?.id;

    if (type === "delivery_payment" && orderId) {
      await service
        .from("orders")
        .update({ delivery_payment_status: "failed" })
        .eq("id", orderId);
    } else if (qrCodeId) {
      await service
        .from("orders")
        .update({ delivery_payment_status: "failed" })
        .eq("delivery_qr_id", qrCodeId);
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