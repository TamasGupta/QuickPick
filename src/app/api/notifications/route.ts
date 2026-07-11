import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

// GET /api/notifications — badge counts for the current user, by context.
//   buyerActive    -> buyer's in-progress orders
//   sellerNew      -> new orders awaiting the seller
//   riderAvailable -> unclaimed packed orders (for riders)
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ buyerActive: 0, sellerNew: 0, riderAvailable: 0 });

  const service = createServiceSupabase();

  const [{ data: profile }, { data: seller }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("sellers").select("id").eq("owner_id", user.id).maybeSingle(),
  ]);

  // Buyer: active (not delivered/cancelled) orders.
  const buyerActive =
    (
      await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", user.id)
        .not("status", "in", "(delivered,cancelled)")
    ).count ?? 0;

  // Seller: brand-new orders needing action.
  let sellerNew = 0;
  if (seller?.id) {
    sellerNew =
      (
        await service
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .eq("status", "placed")
      ).count ?? 0;
  }

  // Rider: packed & unclaimed jobs.
  let riderAvailable = 0;
  if (profile?.role === "rider") {
    riderAvailable =
      (
        await service
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "packed")
          .is("rider_id", null)
      ).count ?? 0;
  }

  return NextResponse.json({ buyerActive, sellerNew, riderAvailable });
}
