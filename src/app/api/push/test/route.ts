import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/push/test — sends a test notification to the logged-in user's
// own subscribed devices. Exists purely to verify the subscribe -> save ->
// send -> receive pipeline works end-to-end without needing to walk through
// a real order lifecycle. Not linked from any UI — hit it directly once
// you've clicked "Enable notifications" and granted permission.
export const POST = withApiLogging("/api/push/test", async () => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await sendPushToUser(user.id, {
    title: "Test notification",
    body: "If you can see this, push notifications are working.",
    url: "/account",
    tag: "push-test",
  });

  return NextResponse.json({ ok: true });
});
