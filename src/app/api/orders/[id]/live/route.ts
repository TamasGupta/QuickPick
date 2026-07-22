import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// GET /api/orders/:id/live — lightweight poll target for the order detail
// page: just the fields that change after the page first loads (status,
// rider assignment). Client-side polling can't read the rider's profile
// directly (RLS keeps other users' profiles private), so this route uses
// the service client the same way the initial server-rendered page does.
export const GET = withApiLogging(
  "/api/orders/[id]/live",
  async (_req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // RLS on `orders` already scopes this to the buyer, the owning seller, or an admin.
    const { data: order } = await supabase
      .from("orders")
      .select("status, delivery_otp, rider_id")
      .eq("id", params.id)
      .single();
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const service = createServiceSupabase();
    const { data: rider } = order.rider_id
      ? await service.from("profiles").select("full_name, phone").eq("id", order.rider_id).single()
      : { data: null };

    return NextResponse.json({
      status: order.status,
      delivery_otp: order.delivery_otp,
      rider: rider ?? null,
    });
  }
);
