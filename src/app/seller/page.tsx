import { redirect } from "next/navigation";
import Link from "next/link";
import { Store } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { SellerStatsLive } from "@/components/SellerStatsLive";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";

export const dynamic = "force-dynamic";

export default async function SellerDashboard() {
  const { user, seller } = await getMySeller();
  if (!user) redirect("/login");
  if (!seller) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-ink-soft">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Store className="h-7 w-7" />
        </span>
        <p className="font-semibold text-ink">This account isn't set up as a seller</p>
        <p className="mt-1 text-sm">
          Seller accounts are created by the GrabOn team. Contact support to get onboarded.
        </p>
      </div>
    );
  }

  const supabase = createServerSupabase();
  const [{ count: productCount }, { data: orders }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("seller_id", seller.id),
    // Unpaid online-payment attempts (abandoned Razorpay checkout) aren't
    // real orders — exclude them from revenue/pending counts.
    supabase
      .from("orders")
      .select("total, status")
      .eq("seller_id", seller.id)
      .neq("payment_status", "pending"),
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

      <SellerStatsLive
        sellerId={seller.id}
        storeStatus={seller.status}
        initial={{ productCount: productCount ?? 0, orderCount: orders?.length ?? 0, revenue, pending }}
      />

      <div className="mt-4">
        <PushNotificationPrompt label="Enable new-order notifications" />
      </div>
    </div>
  );
}
