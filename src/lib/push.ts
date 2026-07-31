import webpush from "web-push";
import { createServiceSupabase } from "@/lib/supabase/server";

// Web Push delivery for the seller/rider PWA. Subscriptions live in
// push_subscriptions (see migration 019), registered by /api/push/subscribe.
// The actual send is a browser-standard encrypted push to the browser's push
// service — no external backend, works on Vercel's Node runtime.
//
// Deliberately best-effort: it never throws, so callers (order / status API
// routes) can fire it without a try/catch and the user-visible request never
// fails because a push didn't go through.

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  // Collapses concurrent pushes with the same tag into one tray entry
  // (e.g. repeated "new delivery available" pings).
  tag?: string;
}

export interface SendPushResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: boolean;
}

// Lazy, module-level init so VAPID keys are only read/validated when a send is
// actually attempted (unconfigured local envs shouldn't break route imports).
let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — skipping push send");
    return false;
  }
  // RFC 8292 requires a contact "subject": a mailto: or an https URL. The app
  // URL is a valid subject and needs no invented email address.
  webpush.setVapidDetails(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://grabon.app",
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

// Sends `payload` to every subscription matching `where` (either a single
// user, or everyone with a role — used to broadcast packed orders to all
// riders). Stale subscriptions that the push service reports as gone
// (404/410) are deleted so they don't keep getting retried forever.
export async function sendPush(
  where: { userId?: string; role?: "seller" | "rider" },
  payload: PushPayload
): Promise<SendPushResult> {
  const result: SendPushResult = { attempted: 0, sent: 0, failed: 0, skipped: true };
  if (!ensureVapidConfigured()) return result;
  result.skipped = false;

  const service = createServiceSupabase();

  let query = service.from("push_subscriptions").select("id, endpoint, p256dh, auth_key");
  if (where.userId) query = query.eq("user_id", where.userId);
  if (where.role) query = query.eq("role", where.role);

  const { data, error } = await query;
  if (error) {
    console.error("[push] failed to load subscriptions", error.message);
    return result;
  }
  if (!data?.length) return result;

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];

  result.attempted = data.length;
  await Promise.all(
    (data as StoredSubscription[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          body,
          { TTL: 60 * 60 * 24 } // 24h — don't let stale pings queue for weeks
        );
        result.sent++;
      } catch (err) {
        result.failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.error("[push] send failed", statusCode ?? (err as Error).message);
        }
      }
    })
  );

  if (staleIds.length) {
    try {
      await service.from("push_subscriptions").delete().in("id", staleIds);
      console.info(`[push] cleaned up ${staleIds.length} stale subscription(s)`);
    } catch (cleanupErr) {
      console.error("[push] failed to clean up stale subscriptions", (cleanupErr as Error).message);
    }
  }

  return result;
}
