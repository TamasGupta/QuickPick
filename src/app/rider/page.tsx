import { redirect } from "next/navigation";
import { Bike } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { RiderDashboard } from "@/components/rider/RiderDashboard";

export const dynamic = "force-dynamic";

export default async function RiderPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/rider");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, phone")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "rider") {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-ink-soft">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <Bike className="h-7 w-7" />
        </span>
        <p className="font-semibold text-ink">This account isn't set up as a delivery partner</p>
        <p className="mt-1 text-sm">
          Delivery partner accounts are created by the GrabOn team. Contact support to get onboarded.
        </p>
      </div>
    );
  }

  return (
    <RiderDashboard
      name={profile?.full_name ?? "Partner"}
      email={user.email ?? null}
      phone={profile?.phone ?? null}
    />
  );
}
