import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMySeller } from "@/lib/seller";
import { SellerNav } from "@/components/SellerNav";
import { SellerProductsList } from "@/components/SellerProductsList";
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
      <SellerProductsList initialProducts={products} />
    </div>
  );
}
