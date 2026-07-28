import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// GET /api/notifications — badge counts for the current user, by context.
//   sellerNew      -> new orders awaiting the seller (only active consumer — SellerNav)
//
// buyerActive and riderAvailable used to be computed here too, but both are
// dead: BottomNav now gets its buyer badge from its own Realtime subscription
// (see useBuyerActiveCount in BottomNav.tsx), and nothing has ever consumed
// riderAvailable — RiderDashboard has always polled /api/rider/orders?scope=
// available for that instead. Left commented rather than deleted in case a
// consumer needs one of them again; until then, computing them here would
// just be two extra DB queries on every SellerNav poll for data nobody reads.
export const GET = withApiLogging("/api/notifications", async (_req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ buyerActive: 0, sellerNew: 0, riderAvailable: 0 });

  const service = createServiceSupabase();

  const { data: seller } = await supabase
    .from("sellers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  // // Buyer: active (not delivered/cancelled) orders. Unused — see comment above.
  // const buyerActive =
  //   (
  //     await supabase
  //       .from("orders")
  //       .select("id", { count: "exact", head: true })
  //       .eq("buyer_id", user.id)
  //       .not("status", "in", "(delivered,cancelled)")
  //   ).count ?? 0;
  const buyerActive = 0;

  // Seller: brand-new orders needing action (exclude unpaid online-payment
  // attempts — those aren't real orders until payment completes).
  let sellerNew = 0;
  if (seller?.id) {
    sellerNew =
      (
        await service
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .eq("status", "placed")
          .neq("payment_status", "pending")
      ).count ?? 0;
  }

  // // Rider: packed & unclaimed jobs. Unused — see comment above.
  // let riderAvailable = 0;
  // if (profile?.role === "rider") {
  //   riderAvailable =
  //     (
  //       await service
  //         .from("orders")
  //         .select("id", { count: "exact", head: true })
  //         .eq("status", "packed")
  //         .is("rider_id", null)
  //     ).count ?? 0;
  // }
  const riderAvailable = 0;

  return NextResponse.json({ buyerActive, sellerNew, riderAvailable });
});
