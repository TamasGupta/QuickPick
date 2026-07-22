import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { LedgerList } from "@/components/LedgerList";
import { inr, formatIST } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

type FullEntry = LedgerEntry & {
  sellers: { store_name: string } | null;
  profiles: { full_name: string | null } | null;
};

export default async function AdminLedgerPage() {
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

  const [{ data: entries }, { data: delivered }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("*, sellers(store_name), profiles(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("other_charges").eq("status", "delivered"),
  ]);

  const list = (entries as FullEntry[]) ?? [];
  const owedToYou = list.filter((e) => e.to_party === "admin" && !e.settled);
  const youOwe = list.filter((e) => e.from_party === "admin" && !e.settled);

  const owedToYouTotal = owedToYou.reduce((s, e) => s + Number(e.amount), 0);
  const youOweTotal = youOwe.reduce((s, e) => s + Number(e.amount), 0);
  const lifetimeRevenue = (delivered ?? []).reduce((s, o) => s + Number(o.other_charges), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Payout ledger</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Owed to you (COD platform fees)</p>
          <p className="mt-1 text-lg font-bold text-brand-700">{inr(owedToYouTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">You owe (online payouts)</p>
          <p className="mt-1 text-lg font-bold text-red-600">{inr(youOweTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Lifetime platform revenue</p>
          <p className="mt-1 text-lg font-bold text-ink">{inr(lifetimeRevenue)}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-bold">Owed to you (sellers settle these)</h2>
        <div className="card">
          <LedgerList entries={owedToYou} canSettle emptyLabel="No pending COD fees right now." />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-bold">You owe (pay sellers/riders, then mark settled)</h2>
        <div className="card">
          <LedgerList entries={youOwe} canSettle emptyLabel="No pending payouts right now." />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-bold">Full ledger ({list.length})</h2>
        <div className="card divide-y divide-gray-100">
          {list.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-faint">No ledger entries yet.</p>
          ) : (
            list.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{e.label}</p>
                  <p className="text-xs text-ink-faint">
                    {e.from_party} → {e.to_party} · {e.sellers?.store_name ?? "—"}
                    {e.profiles?.full_name ? ` · ${e.profiles.full_name}` : ""} · {formatIST(e.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-bold">{inr(e.amount)}</span>
                  <span className={`badge ${e.settled ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
                    {e.settled ? "Settled" : "Pending"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
