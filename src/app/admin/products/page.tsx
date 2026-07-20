import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminProductsTable } from "@/components/admin/AdminProductsTable";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

// Hard cap so one runaway catalog can't blow the page's payload — revisit
// with real pagination if the combined catalog ever approaches this.
const MAX_PRODUCTS = 500;

export default async function AdminProductsPage() {
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
        <p className="text-sm">This console is restricted to GrabOn administrators.</p>
      </div>
    );
  }

  // RLS (products_read) already grants admins every row regardless of
  // seller — see is_admin() in supabase/schema.sql. Full row (not just
  // display fields) so the edit modal has everything it needs.
  const { data } = await supabase
    .from("products")
    .select("*, sellers(store_name)")
    .order("created_at", { ascending: false })
    .limit(MAX_PRODUCTS);

  const products = (data ?? []) as unknown as (Product & { sellers: { store_name: string } | null })[];

  return (
    <div className="space-y-4">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Admin console
      </Link>
      <h1 className="text-xl font-extrabold">All products ({products.length})</h1>
      <AdminProductsTable products={products} />
    </div>
  );
}
