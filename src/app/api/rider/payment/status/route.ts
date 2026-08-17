import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { withApiLogging } from "@/lib/apiLogger";

// GET /api/rider/payment/status?order_id= — lightweight poll target for the
// rider's dashboard while a QR is being shown to the buyer. The order stays
// on "active"'s existing full-list refetch pattern otherwise (see
// RiderDashboard.tsx); this exists so a single card can cheaply check "did
// the webhook land yet" every few seconds without re-fetching everything.
export const GET = withApiLogging("/api/rider/payment/status", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId) return NextResponse.json({ error: "order_id required" }, { status: 400 });

  const service = createServiceSupabase();
  const { data: order } = await service
    .from("orders")
    .select("rider_id, payment_status, delivery_payment_method")
    .eq("id", orderId)
    .single();
  if (!order || order.rider_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    payment_status: order.payment_status,
    delivery_payment_method: order.delivery_payment_method,
  });
});
