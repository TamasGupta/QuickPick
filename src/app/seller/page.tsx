import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { SellerOnboard } from "@/components/SellerOnboard";
import { inr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerDashboard() {
  const { user, seller } = await getMySeller();
  if (!user) redirect("/login");
  if (!seller) return <SellerOnboard />;

  const supabase = createServerSupabase();
  const [{ count: productCount }, { data: orders }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("seller_id", seller.id),
    supabase.from("orders").select("total, status").eq("seller_id", seller.id),
  ]);

  const revenue = (orders ?? [])
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);
  const pending = (orders ?? []).filter((o) => ["placed", "accepted", "packed"].includes(o.status)).length;

  return (
    <div>
      <SellerNav />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{seller.store_name}</h1>
          <span
            className={`badge ${
              seller.status === "approved"
                ? "bg-brand-50 text-brand-700"
                : seller.status === "pending"
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {seller.status.toUpperCase()}
          </span>
        </div>
        <Link href="/seller/upload" className="btn-primary">+ Bulk upload</Link>
      </div>

      {seller.status === "pending" && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Your store is awaiting admin approval. You can upload products now; they’ll go live once approved.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Products" value={String(productCount ?? 0)} />
        <Stat label="Orders" value={String(orders?.length ?? 0)} />
        <Stat label="Revenue" value={inr(revenue)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Pending orders" value={String(pending)} />
        <Stat label="Store status" value={seller.status} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
