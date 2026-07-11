import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { RiderJoin } from "@/components/rider/RiderJoin";
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
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "rider") {
    return <RiderJoin name={profile?.full_name ?? null} />;
  }

  return <RiderDashboard name={profile?.full_name ?? "Partner"} />;
}
