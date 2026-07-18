import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// GET /api/sellers/:id/location — a store's approximate coordinates, so the
// buyer can be warned client-side if their address is outside the delivery
// radius before they reach checkout. The authoritative check still happens
// server-side in /api/orders.
export const GET = withApiLogging(
  "/api/sellers/[id]/location",
  async (_req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("sellers")
      .select("lat, lng")
      .eq("id", params.id)
      .eq("status", "approved")
      .single();
    if (error || !data) return NextResponse.json({ error: "Store not found" }, { status: 404 });
    return NextResponse.json({ lat: data.lat, lng: data.lng });
  }
);
