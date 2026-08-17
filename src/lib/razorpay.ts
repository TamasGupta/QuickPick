import Razorpay from "razorpay";
import crypto from "crypto";

// Server-only Razorpay instance.
export function getRazorpay() {
  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// The Node SDK doesn't throw Error instances — API failures reject with a
// plain { statusCode, error: { code, description, ... } } object (see
// node_modules/razorpay/dist/api.js's normalizeError), so a bare
// `err.message` read is always undefined. Routes catching a Razorpay call
// should extract the message through this instead.
export function razorpayErrorMessage(err: unknown): string {
  const e = err as { error?: { description?: string }; message?: string };
  return e?.error?.description ?? e?.message ?? "Razorpay request failed";
}

// Verify the payment signature returned by Razorpay checkout (HMAC-SHA256).
// TEMPORARY: unused while checkout is COD-only — see /api/payment/verify
// (currently disabled) and checkout/page.tsx's ONLINE_CHECKOUT_ENABLED.
export function verifyPaymentSignature(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const body = `${params.razorpay_order_id}|${params.razorpay_payment_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  // Constant-time compare.
  const a = Buffer.from(expected);
  const b = Buffer.from(params.razorpay_signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Verify a Razorpay WEBHOOK payload's signature (HMAC-SHA256 of the raw
// request body, using the webhook secret set in the Razorpay Dashboard —
// NOT RAZORPAY_KEY_SECRET, a separate value). See /api/webhooks/razorpay.
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Creates a single-use, fixed-amount UPI QR code for a rider to show a buyer
// at the door (see /api/rider/payment/method). Money lands directly in the
// platform's Razorpay account — confirmed via the `qr_code.credited`
// webhook (/api/webhooks/razorpay), not a client-side signature, since the
// buyer pays with their own UPI app on their own phone with no browser
// round-trip back to us.
export async function createDeliveryQr(params: { orderId: string; amountPaise: number }) {
  const razorpay = getRazorpay();
  return razorpay.qrCode.create({
    type: "upi_qr",
    name: "GrabOn delivery payment",
    usage: "single_use",
    fixed_amount: true,
    payment_amount: params.amountPaise,
    description: `Order ${params.orderId.slice(0, 8)}`,
    // Razorpay requires this at least 15 min out — comfortably past any
    // realistic door-side wait so a rider can't leave a stale, still-open
    // QR collectible long after they've moved on.
    close_by: Math.floor(Date.now() / 1000) + 30 * 60,
    notes: { order_id: params.orderId },
  });
}

// Re-fetches an existing QR (image_url + status) — used when the rider
// already generated one for this order (e.g. reopened the delivery card)
// so we redisplay the same collectible instead of creating a duplicate.
export async function fetchDeliveryQr(qrId: string) {
  return getRazorpay().qrCode.fetch(qrId);
}

// Best-effort close — called when a rider switches from "online" back to
// "cash" after already generating a QR, so a late scan can't still succeed
// after the fact. Failures are swallowed: the order's own
// delivery_payment_method/payment_status are the source of truth for what
// actually happened, not the QR code's own open/closed state.
export async function closeDeliveryQr(qrId: string): Promise<void> {
  try {
    await getRazorpay().qrCode.close(qrId);
  } catch {
    // Already closed/expired, or a transient API error — either way, the
    // order has already moved on to cash.
  }
}
