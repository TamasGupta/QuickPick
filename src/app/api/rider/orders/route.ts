import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { enrichOrders, requireRider } from "@/lib/rider";
import { withApiLogging } from "@/lib/apiLogger";

// GET /api/rider/orders?scope=available|active|history
// Returns delivery jobs for the logged-in rider. Uses the service client so we
// can surface buyer/address details without loosening RLS across the board.
export const GET = withApiLogging("/api/rider/orders", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

const params = new URL(req.url).searchParams;
  const scope = params.get("scope") ?? "available";
  const limit = Math.min(Number(params.get("limit")) || 50, 100);
  const offset = Number(params.get("offset")) || 0;
  const fromDate = params.get("from_date");
  const toDate = params.get("to_date");
  const service = createServiceSupabase();

  let query = service
    .from("orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (fromDate) {
    query = query.gte("created_at", fromDate);
  }
  if (toDate) {
    query = query.lte("created_at", toDate);
  }

  if (scope === "available") {
    // Unclaimed, from the start of the pipeline (placed/accepted/packed/action_required) so
    // riders can see what's coming before the seller packs it — not just
    // claimable (packed) orders. Claiming itself still requires 'packed'
    // (enforced atomically in /api/rider/claim), and already paid (online)
    // or COD.
    query = query
      .in("status", ["placed", "accepted", "packed", "action_required"])
      .is("rider_id", null);
  } else if (scope === "active") {
    query = query.eq("rider_id", user.id).in("status", ["packed", "out_for_delivery"]);
  } else {
    query = query.eq("rider_id", user.id).eq("status", "delivered");
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = await enrichOrders(service, (data ?? []) as Record<string, unknown>[]);
  console.log(`[rider/orders] scope=${scope} returning ${orders.length} orders (total: ${count})`);
  return NextResponse.json({ orders, total: count ?? 0, limit, offset });
});
