import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminSellerRow } from "@/components/AdminSellerRow";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-gray-500">
        <p className="text-4xl">🔒</p>
        <p className="mt-2 font-semibold">Admins only</p>
        <p className="text-sm">
          Set your profile role to <code>admin</code> in the database to access this page.
        </p>
      </div>
    );
  }

  const [{ data: sellers }, { count: orderCount }, { count: productCount }] = await Promise.all([
    supabase.from("sellers").select("id, store_name, city, status").order("created_at", { ascending: false }),
    // Exclude abandoned/unpaid online-payment attempts from the count.
    supabase.from("orders").select("id", { count: "exact", head: true }).neq("payment_status", "pending"),
    supabase.from("products").select("id", { count: "exact", head: true }),
  ]);

  const pending = (sellers ?? []).filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Admin console</h1>
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Sellers" value={String(sellers?.length ?? 0)} />
        <Stat label="Pending" value={String(pending)} />
        <Stat label="Products" value={String(productCount ?? 0)} />
        <Stat label="Orders" value={String(orderCount ?? 0)} />
      </div>

      <div>
        <h2 className="mb-2 font-bold">Sellers</h2>
        <div className="card divide-y">
          {(sellers ?? []).map((s) => (
            <AdminSellerRow key={s.id} seller={s as any} />
          ))}
          {(sellers ?? []).length === 0 && (
            <p className="p-6 text-center text-sm text-gray-500">No sellers yet.</p>
          )}
        </div>
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
