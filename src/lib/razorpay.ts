import Razorpay from "razorpay";
import crypto from "crypto";

// Server-only Razorpay instance.
export function getRazorpay() {
  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// Verify the payment signature returned by Razorpay checkout (HMAC-SHA256).
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
