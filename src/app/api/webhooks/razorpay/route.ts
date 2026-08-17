import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/webhooks/razorpay — server-to-server callback from Razorpay,
// not a user-facing route. This is how a door-side QR payment (see
// /api/rider/payment/method) actually gets confirmed: the buyer pays with
// their own UPI app on their own phone, so there's no browser round-trip
// back to us to carry a client-side signature the way checkout.js's flow
// worked (see the now-disabled /api/payment/verify).
//
// Configure in Razorpay Dashboard → Settings → Webhooks:
//   URL: https://<your-domain>/api/webhooks/razorpay
//   Active events: qr_code.credited
//   Secret: any random string — set the SAME value as RAZORPAY_WEBHOOK_SECRET
// Webhooks don't fire against localhost — use a tunnel (e.g. ngrok) to test
// this route against local dev, or just exercise it directly (see the task
// notes) since the signature check is the only real gate.
export const POST = withApiLogging(
  "/api/webhooks/razorpay",
  async (req: Request) => {
    // Signature is computed over the exact raw bytes — must read as text
    // before any JSON parsing touches it.
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload?: {
        qr_code?: { entity?: { id?: string } };
        payment?: { entity?: { id?: string; amount?: number } };
      };
    };

    if (event.event !== "qr_code.credited") {
      // Ack anything we don't act on so Razorpay doesn't keep retrying it.
      return NextResponse.json({ ok: true });
    }

    const qrId = event.payload?.qr_code?.entity?.id;
    const paymentId = event.payload?.payment?.entity?.id;
    const amountPaise = event.payload?.payment?.entity?.amount;
    if (!qrId || !paymentId) {
      return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
    }

    const service = createServiceSupabase();
    const { data: order } = await service
      .from("orders")
      .select("id, total, payment_status")
      .eq("razorpay_qr_id", qrId)
      .single();
    if (!order) {
      // Either a stale/closed QR from a much older order, or a race with
      // the rider switching back to cash right as the buyer paid. Ack it —
      // retrying won't make a matching order appear.
      return NextResponse.json({ ok: true });
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ ok: true }); // idempotent — webhook retries are routine
    }

    if (amountPaise != null && amountPaise !== Math.round(Number(order.total) * 100)) {
      // The QR was created with fixed_amount:true for this exact total, so
      // this shouldn't happen — record it, but still mark the order paid
      // since real money genuinely landed and blocking the delivery over a
      // logging concern would be worse.
      console.error(
        `[webhooks/razorpay] amount mismatch on order ${order.id}: expected ${order.total}, got ${amountPaise / 100}`
      );
    }

    // Stock was already decremented at order creation (checkout is COD-only
    // — see /api/orders) — this only ever flips payment_status, never stock.
    await service
      .from("orders")
      .update({
        payment_status: "paid",
        razorpay_payment_id: paymentId,
        delivery_payment_method: "online",
      })
      .eq("id", order.id);

    return NextResponse.json({ ok: true });
  },
  { rateLimit: false }
);
