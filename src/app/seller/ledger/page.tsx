import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { LedgerList } from "@/components/LedgerList";
import { inr } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SellerLedgerPage() {
  const { user, seller } = await getMySeller();
  if (!user) redirect("/login");
  if (!seller) redirect("/seller");

  const supabase = createServerSupabase();

  const [{ data: entries }, { data: delivered }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("subtotal").eq("seller_id", seller.id).eq("status", "delivered"),
  ]);

  const list = (entries as LedgerEntry[]) ?? [];
  const owedToYou = list.filter((e) => e.to_party === "seller" && !e.settled);
  const youOwe = list.filter((e) => e.from_party === "seller" && !e.settled);
  const settled = list.filter((e) => e.settled);

  const owedToYouTotal = owedToYou.reduce((s, e) => s + Number(e.amount), 0);
  const youOweTotal = youOwe.reduce((s, e) => s + Number(e.amount), 0);
  const lifetimeEarnings = (delivered ?? []).reduce((s, o) => s + Number(o.subtotal), 0);

  return (
    <div>
      <SellerNav />
      <h1 className="mb-1 text-xl font-extrabold">Payout ledger</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Online orders: we pay you your share. COD orders: you collect the full amount from the rider, so you owe us
        and the rider their shares back.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Owed to you</p>
          <p className="mt-1 text-lg font-bold text-brand-700">{inr(owedToYouTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">You owe</p>
          <p className="mt-1 text-lg font-bold text-red-600">{inr(youOweTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Lifetime earnings</p>
          <p className="mt-1 text-lg font-bold text-ink">{inr(lifetimeEarnings)}</p>
        </div>
      </div>

      <div className="mt-4">
        <h2 className="mb-2 font-bold">Owed to you (we pay you)</h2>
        <div className="card">
          <LedgerList entries={owedToYou} canSettle={false} emptyLabel="Nothing pending from us right now." />
        </div>
      </div>

      <div className="mt-4">
        <h2 className="mb-2 font-bold">You owe (settle these yourself)</h2>
        <div className="card">
          <LedgerList entries={youOwe} canSettle emptyLabel="You don't owe anything right now." />
        </div>
      </div>

      {settled.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 font-bold">Settled history</h2>
          <div className="card">
            <LedgerList entries={settled} canSettle={false} />
          </div>
        </div>
      )}
    </div>
  );
}
