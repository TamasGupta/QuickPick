import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { withApiLogging } from "@/lib/apiLogger";

export const GET = withApiLogging("/api/rider/remittances", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const service = createServiceSupabase();

  // Fetch orders where rider has pending remittance
  const { data: orders, error } = await service
    .from("orders")
    .select("id, rider_remittance_due, rider_remittance_status, razorpay_remittance_order_id, total, subtotal, delivery_fee, other_charges, payment_status, payment_mode")
    .eq("rider_id", user.id)
    .eq("rider_remittance_status", "pending")
    .gt("rider_remittance_due", 0);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    remittances: (orders ?? []).map((o) => ({
      id: o.id,
      order_id: o.id,
      amount: o.rider_remittance_due,
      status: o.rider_remittance_status,
      razorpay_order_id: o.razorpay_remittance_order_id,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })),
  });
});