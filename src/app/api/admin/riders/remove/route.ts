import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

// POST /api/admin/riders/remove — revoke a delivery partner's access
// (reverts their profile back to a plain buyer).
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireAdmin(supabase, user))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { rider_id } = (await req.json().catch(() => ({}))) as { rider_id?: string };
  if (!rider_id) return NextResponse.json({ error: "rider_id required" }, { status: 400 });

  const service = createServiceSupabase();
  const { error } = await service.from("profiles").update({ role: "buyer" }).eq("id", rider_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
