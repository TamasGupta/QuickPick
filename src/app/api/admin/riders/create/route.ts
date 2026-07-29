import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/admin/riders/create — super admin onboards a new delivery
// partner. email is the login identity; phone is plain contact info (a
// buyer needs to be able to call their rider during delivery) — see
// migration 018 for why auth moved from phone to email.
export const POST = withApiLogging("/api/admin/riders/create", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireAdmin(supabase, user))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    phone?: string;
    full_name?: string;
  };
  if (!body.email || !body.phone || !body.full_name) {
    return NextResponse.json({ error: "email, phone and full_name are required" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const phoneDigits = body.phone.replace(/\D/g, "").slice(-10);
  if (phoneDigits.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }
  // Stored with the "91" prefix, no "+" — matches the format the old
  // phone-auth flow used to write, which every existing display of this
  // field (e.g. AdminRiderRow, buyer-facing rider contact links) expects.
  const phoneStored = `91${phoneDigits}`;

  const service = createServiceSupabase();

  let userId: string;
  const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    // The email may exist but be unconfirmed (e.g. a real OTP was requested
    // once but never completed).
    await service.auth.admin.updateUserById(userId, { email_confirm: true });
  } else {
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    userId = created.user!.id;
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({ role: "rider", full_name: body.full_name, email, phone: phoneStored })
    .eq("id", userId);
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, rider_id: userId, email });
});
