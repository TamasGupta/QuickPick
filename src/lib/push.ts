// Server-only Web Push send helper. Deliberately never throws — every
// caller is a fire-and-forget hook inserted right after a real mutation
// (order created, status changed, etc.), and a push failure must never
// block or fail that mutation's own response.
import webpush from "web-push";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

const vapidConfigured =
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY && !!process.env.VAPID_SUBJECT;

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

// Buyer-facing copy per order status — shared by /api/orders/[id]/status
// (seller-driven: accepted/packed/cancelled) and /api/rider/[action]
// (rider-driven: out_for_delivery via pickup, delivered via the
// OTP-verified deliver action), so the wording is identical regardless of
// which route actually caused the transition.
export const ORDER_STATUS_PUSH_COPY: Partial<Record<OrderStatus, string>> = {
  accepted: "The store has accepted your order and is preparing it.",
  packed: "Your order is packed and waiting for a delivery partner.",
  out_for_delivery: "Your order is out for delivery.",
  delivered: "Your order has been delivered. Enjoy!",
  cancelled: "Your order was cancelled by the store.",
};

export interface PushPayload {
  title: string;
  body: string;
  // Deep-linked to on notificationclick (see worker/index.js) — defaults to
  // "/" if omitted.
  url?: string;
  // Notifications sharing a tag replace each other instead of stacking —
  // use an order's id so a second status change collapses onto the first
  // notification rather than piling up.
  tag?: string;
}

// Sends to every subscribed device for a user (multiple devices = multiple
// rows). Prunes a subscription on 404/410 — the push service's signal that
// it's permanently gone (browser data cleared, uninstalled, etc.), so it
// stops being retried forever.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!vapidConfigured) {
    console.error("[push] VAPID not configured — skipping send");
    return;
  }

  try {
    const service = createServiceSupabase();
    const { data: subs, error } = await service
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error || !subs?.length) return;

    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await service.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("[push] send failed", sub.id, (err as Error).message);
          }
        }
      })
    );
  } catch (err) {
    console.error("[push] sendPushToUser failed", userId, (err as Error).message);
  }
}
