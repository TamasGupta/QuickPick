import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin, toE164 } from "@/lib/admin";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/admin/riders/create — super admin onboards a new delivery partner.
export const POST = withApiLogging("/api/admin/riders/create", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireAdmin(supabase, user))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { phone?: string; full_name?: string };
  if (!body.phone || !body.full_name) {
    return NextResponse.json({ error: "phone and full_name are required" }, { status: 400 });
  }

  const phone = toE164(body.phone);
  if (!/^\+91\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }

  const service = createServiceSupabase();

  let userId: string;
  const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existing = list.users.find((u) => u.phone === phone.replace("+", ""));
  if (existing) {
    userId = existing.id;
    // The phone may exist but be unconfirmed (e.g. a real OTP was requested
    // once but SMS delivery failed before the user could verify it).
    await service.auth.admin.updateUserById(userId, { phone_confirm: true });
  } else {
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    userId = created.user!.id;
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({ role: "rider", full_name: body.full_name })
    .eq("id", userId);
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, rider_id: userId, phone });
});
