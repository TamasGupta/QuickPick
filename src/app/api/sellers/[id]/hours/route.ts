import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";
import type { StoreHour } from "@/lib/types";

// GET /api/sellers/:id/hours
// Returns the store's full weekly schedule and whether it is open right now.
// Used by the checkout page for a client-side buyer-facing heads-up. The
// authoritative open/closed gate still runs server-side in /api/orders.
export const GET = withApiLogging(
  "/api/sellers/[id]/hours",
  async (_req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();

    const [{ data: seller }, { data: schedule }, { data: openResult }] =
      await Promise.all([
        supabase
          .from("sellers")
          .select("timezone")
          .eq("id", params.id)
          .eq("status", "approved")
          .single(),
        supabase
          .from("store_hours")
          .select("*")
          .eq("seller_id", params.id)
          .order("day_of_week"),
        supabase.rpc("is_store_open", { p_seller_id: params.id }),
      ]);

    if (!seller) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    return NextResponse.json({
      is_open: openResult ?? true, // no hours configured → always open
      timezone: seller.timezone ?? "Asia/Kolkata",
      schedule: (schedule as StoreHour[]) ?? [],
    });
  }
);
