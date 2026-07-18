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

  const scope = new URL(req.url).searchParams.get("scope") ?? "available";
  const service = createServiceSupabase();

  let query = service
    .from("orders")
    .select("*")
    .order("created_at", { ascending: scope === "available" });

  if (scope === "available") {
    // Packed & unclaimed, and already paid (online) or COD.
    query = query.eq("status", "packed").is("rider_id", null);
  } else if (scope === "active") {
    query = query.eq("rider_id", user.id).in("status", ["packed", "out_for_delivery"]);
  } else {
    query = query.eq("rider_id", user.id).eq("status", "delivered");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = await enrichOrders(service, (data ?? []) as Record<string, unknown>[]);
  return NextResponse.json({ orders });
});
