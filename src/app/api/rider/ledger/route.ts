import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { withApiLogging } from "@/lib/apiLogger";

// GET /api/rider/ledger — this rider's payout ledger (read-only; riders are
// never the payer on an entry, so there's nothing to settle here) plus their
// lifetime delivery-fee earnings across every order they've completed.
export const GET = withApiLogging("/api/rider/ledger", async (_req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const service = createServiceSupabase();
  const [{ data: entries }, { data: delivered }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("rider_id", user.id)
      .eq("to_party", "rider")
      .order("created_at", { ascending: false }),
    service.from("orders").select("delivery_fee").eq("rider_id", user.id).eq("status", "delivered"),
  ]);

  const lifetimeEarnings = (delivered ?? []).reduce((s, o) => s + Number(o.delivery_fee), 0);

  return NextResponse.json({ entries: entries ?? [], lifetimeEarnings });
});
