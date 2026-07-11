import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

const now = () => new Date().toISOString();

// POST /api/rider/claim | /api/rider/pickup | /api/rider/deliver
export async function POST(
  req: Request,
  { params }: { params: { action: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { order_id?: string; otp?: string };
  const orderId = body.order_id;
  if (!orderId) return NextResponse.json({ error: "order_id required" }, { status: 400 });

  const service = createServiceSupabase();

  if (params.action === "claim") {
    // Atomic claim: only succeeds if still packed & unassigned.
    const { data, error } = await service
      .from("orders")
      .update({ rider_id: user.id, updated_at: now() })
      .eq("id", orderId)
      .eq("status", "packed")
      .is("rider_id", null)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) {
      return NextResponse.json({ error: "Order was already taken" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (params.action === "pickup") {
    const { data, error } = await service
      .from("orders")
      .update({ status: "out_for_delivery", updated_at: now() })
      .eq("id", orderId)
      .eq("rider_id", user.id)
      .eq("status", "packed")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Cannot pick up this order" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (params.action === "deliver") {
    // Verify the buyer's delivery OTP before completing.
    const { data: order } = await service
      .from("orders")
      .select("delivery_otp, rider_id, status, payment_status")
      .eq("id", orderId)
      .single();
    if (!order || order.rider_id !== user.id || order.status !== "out_for_delivery") {
      return NextResponse.json({ error: "Cannot complete this order" }, { status: 409 });
    }
    if (!body.otp || body.otp.trim() !== order.delivery_otp) {
      return NextResponse.json({ error: "Incorrect delivery OTP" }, { status: 422 });
    }
    // Cash collected on delivery -> mark COD orders paid.
    const patch: Record<string, unknown> = { status: "delivered", updated_at: now() };
    if (order.payment_status === "cod") patch.payment_status = "paid";
    const { error } = await service.from("orders").update(patch).eq("id", orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
}
