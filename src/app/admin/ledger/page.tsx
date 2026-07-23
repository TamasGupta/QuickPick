import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminLedgerView, type AdminLedgerEntry } from "@/components/AdminLedgerView";
import { SellerFilterSelect } from "@/components/admin/SellerFilterSelect";
import { HistoryFilters } from "@/components/HistoryFilters";
import { istDayBounds, HISTORY_PAGE_SIZE } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

type FullEntry = LedgerEntry & {
  sellers: { store_name: string } | null;
  profiles: { full_name: string | null } | null;
};

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: { seller?: string; from?: string; to?: string; page?: string };
}) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-gray-500">
        <p className="text-4xl">🔒</p>
        <p className="mt-2 font-semibold">Admins only</p>
      </div>
    );
  }

  const page = Math.max(1, Number(searchParams.page) || 1);
  const offset = (page - 1) * HISTORY_PAGE_SIZE;

  let query = supabase
    .from("ledger_entries")
    .select("*, sellers(store_name), profiles(full_name)")
    .order("created_at", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE); // one extra row -> hasMore
  if (searchParams.seller) query = query.eq("seller_id", searchParams.seller);
  if (searchParams.from) query = query.gte("created_at", istDayBounds(searchParams.from).startIso);
  if (searchParams.to) query = query.lte("created_at", istDayBounds(searchParams.to).endIso);

  const [{ data: entries }, { data: delivered }, { data: sellers }] = await Promise.all([
    query,
    supabase.from("orders").select("other_charges").eq("status", "delivered"),
    supabase.from("sellers").select("id, store_name").order("store_name"),
  ]);

  const rows = (entries as FullEntry[]) ?? [];
  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const list = hasMore ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;
  const enriched: AdminLedgerEntry[] = list.map((e) => ({
    ...e,
    seller_name: e.sellers?.store_name ?? null,
    rider_name: e.profiles?.full_name ?? null,
  }));
  // Lifetime revenue is a true all-time total — not affected by the date
  // filter/pagination above, which only scope the history list below.
  const lifetimeRevenue = (delivered ?? []).reduce((s, o) => s + Number(o.other_charges), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Payout ledger</h1>
        <SellerFilterSelect sellers={sellers ?? []} />
      </div>
      <HistoryFilters hasMore={hasMore} page={page} />
      <AdminLedgerView initialEntries={enriched} lifetimeRevenue={lifetimeRevenue} />
    </div>
  );
}
