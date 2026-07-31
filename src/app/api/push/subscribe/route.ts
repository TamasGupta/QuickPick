import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

type PushRole = "seller" | "rider";

interface SubscriptionBody {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  role: PushRole;
}

const ROLES: PushRole[] = ["seller", "rider"];

// POST /api/push/subscribe — store this browser's Web Push subscription for
// the logged-in user, so order/status API routes can notify them when the app
// is closed. Upserts on `endpoint`: re-subscribing (or logging in as a
// different user on the same browser) replaces the old row instead of
// accumulating dead ones. Writes go through the RLS-bound cookie client, so
// push_subscriptions_own (user_id = auth.uid()) governs access.
export const POST = withApiLogging("/api/push/subscribe", async (req: Request) => {
  const supabase = createServerSupabase();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const service = createServiceSupabase();
      const { data } = await service.auth.getUser(token);
      user = data.user;
    }
  }

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { subscription, role } = (await req.json()) as SubscriptionBody;
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Only register a role the user actually holds — otherwise a buyer could
  // subscribe as a rider and get every rider broadcast. Mirrors requireRider()
  // in lib/rider.ts.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== role) {
    return NextResponse.json({ error: "Role does not match your account" }, { status: 403 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        role,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

// DELETE /api/push/subscribe — remove one endpoint (e.g. when the user opts
// out or a device is uninstalled). Body: { endpoint }.
export const DELETE = withApiLogging("/api/push/subscribe", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
