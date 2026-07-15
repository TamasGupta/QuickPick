import type { SupabaseClient, User } from "@supabase/supabase-js";

// Confirms the caller's profile role is 'admin' before any admin route
// creates accounts or manages sellers/riders on someone else's behalf.
export async function requireAdmin(supabase: SupabaseClient, user: User): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin";
}

export { toE164 } from "@/lib/phone";
