import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { SellerProductRow } from "@/components/SellerProductRow";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const { user, seller } = await getMySeller();
  if (!user) redirect("/login");
  if (!seller) redirect("/seller");

  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: false });
  const products = (data as Product[]) ?? [];

  return (
    <div>
      <SellerNav />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Products ({products.length})</h1>
        <Link href="/seller/upload" className="btn-primary">+ Bulk upload</Link>
      </div>

      {products.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No products yet.{" "}
          <Link href="/seller/upload" className="text-brand-700 underline">Upload a file</Link> to add your catalog.
        </div>
      ) : (
        <div className="card divide-y">
          {products.map((p) => (
            <SellerProductRow key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
