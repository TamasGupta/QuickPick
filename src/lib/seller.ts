import { createServerSupabase } from "@/lib/supabase/server";

// Fetch the current user's seller store (or null). Shared by seller pages.
export async function getMySeller() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, seller: null };

  const { data: seller } = await supabase
    .from("sellers")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return { user, seller };
}
