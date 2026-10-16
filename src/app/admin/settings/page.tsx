import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAppSettings, getProductRestrictionsList } from "@/lib/settings";
import { AdminSettingsView } from "@/components/admin/AdminSettingsView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform Settings — Admin Console",
};

export default async function AdminSettingsPage() {
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
        <p className="text-sm">This console is restricted to administrators.</p>
      </div>
    );
  }

  const [settings, restrictions] = await Promise.all([
    getAppSettings(),
    getProductRestrictionsList(),
  ]);

  return (
    <AdminSettingsView
      initialSettings={settings}
      initialRestrictions={restrictions}
    />
  );
}
