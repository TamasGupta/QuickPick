import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminSellerRow } from "@/components/AdminSellerRow";
import { AdminRiderRow } from "@/components/admin/AdminRiderRow";
import { CreateSellerForm } from "@/components/admin/CreateSellerForm";
import { CreateRiderForm } from "@/components/admin/CreateRiderForm";

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
        <p className="text-sm">This console is restricted to QuickPick administrators.</p>
      </div>
    );
  }

  const [{ data: sellers }, { count: orderCount }, { count: productCount }, { data: riders }] =
    await Promise.all([
      supabase.from("sellers").select("id, store_name, city, status").order("created_at", { ascending: false }),
      // Exclude abandoned/unpaid online-payment attempts from the count.
      supabase.from("orders").select("id", { count: "exact", head: true }).neq("payment_status", "pending"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id, full_name, phone").eq("role", "rider").order("created_at", { ascending: false }),
    ]);

  const pending = (sellers ?? []).filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Admin console</h1>
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Sellers" value={String(sellers?.length ?? 0)} />
        <Stat label="Riders" value={String(riders?.length ?? 0)} />
        <Stat label="Products" value={String(productCount ?? 0)} />
        <Stat label="Orders" value={String(orderCount ?? 0)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CreateSellerForm />
        <CreateRiderForm />
      </div>

      <div>
        <h2 className="mb-2 font-bold">Sellers {pending > 0 && `(${pending} pending)`}</h2>
        <div className="card divide-y">
          {(sellers ?? []).map((s) => (
            <AdminSellerRow key={s.id} seller={s as any} />
          ))}
          {(sellers ?? []).length === 0 && (
            <p className="p-6 text-center text-sm text-gray-500">No sellers yet.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-bold">Delivery partners</h2>
        <div className="card divide-y">
          {(riders ?? []).map((r) => (
            <AdminRiderRow key={r.id} rider={r as any} />
          ))}
          {(riders ?? []).length === 0 && (
            <p className="p-6 text-center text-sm text-gray-500">No delivery partners yet.</p>
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
