import { redirect } from "next/navigation";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { SellerLedgerView } from "@/components/SellerLedgerView";
import { HistoryFilters } from "@/components/HistoryFilters";
import { istDayBounds, HISTORY_PAGE_SIZE } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";
import type { RiderLedgerEntry } from "@/components/RiderPayoutsPanel";

export const dynamic = "force-dynamic";

export default async function SellerLedgerPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; page?: string };
}) {
  const { user, seller } = await getMySeller();
  if (!user) redirect("/login");
  if (!seller) redirect("/seller");

  const supabase = createServerSupabase();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const offset = (page - 1) * HISTORY_PAGE_SIZE;

  let query = supabase
    .from("ledger_entries")
    .select("*")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE); // one extra row -> hasMore
  if (searchParams.from) query = query.gte("created_at", istDayBounds(searchParams.from).startIso);
  if (searchParams.to) query = query.lte("created_at", istDayBounds(searchParams.to).endIso);

  const [{ data: entries }, { data: delivered }] = await Promise.all([
    query,
    supabase.from("orders").select("subtotal").eq("seller_id", seller.id).eq("status", "delivered"),
  ]);

  const rows = (entries as LedgerEntry[]) ?? [];
  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const list = hasMore ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;

  // Rider names via the service client — RLS keeps other users' profiles
  // private, so a seller-scoped query can't read them (same reason
  // orders/[id]/page.tsx does this for the buyer-facing rider card).
  const riderIds = [...new Set(list.map((e) => e.rider_id).filter(Boolean))] as string[];
  const { data: riderProfiles } = riderIds.length
    ? await createServiceSupabase().from("profiles").select("id, full_name").in("id", riderIds)
    : { data: [] };
  const riderNameById = new Map((riderProfiles ?? []).map((p) => [p.id, p.full_name]));
  const enriched: RiderLedgerEntry[] = list.map((e) => ({
    ...e,
    rider_name: (e.rider_id && riderNameById.get(e.rider_id)) ?? null,
  }));

  // Lifetime earnings is a true all-time total — deliberately not affected
  // by the date filter/pagination above, which only scope the history list.
  const lifetimeEarnings = (delivered ?? []).reduce((s, o) => s + Number(o.subtotal), 0);

  return (
    <div>
      <SellerNav />
      <h1 className="mb-1 text-xl font-extrabold">Payout ledger</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Online orders: we pay you your share. COD orders: you collect the full amount from the rider, so you owe the
        rider and us their shares back — usually settled the day after delivery.
      </p>
      <div className="mb-4">
        <HistoryFilters hasMore={hasMore} page={page} />
      </div>
      <SellerLedgerView initialEntries={enriched} lifetimeEarnings={lifetimeEarnings} />
    </div>
  );
}
