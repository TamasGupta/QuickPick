import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin, toE164 } from "@/lib/admin";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/admin/sellers/create — super admin onboards a new seller.
// Creates (or reuses) the phone-auth account, sets role='seller', and
// creates an approved store — sellers no longer self-register.
export const POST = withApiLogging("/api/admin/sellers/create", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireAdmin(supabase, user))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    full_name?: string;
    store_name?: string;
    city?: string;
    pincode?: string;
    address_line?: string;
  };
  if (!body.phone || !body.store_name) {
    return NextResponse.json({ error: "phone and store_name are required" }, { status: 400 });
  }

  const phone = toE164(body.phone);
  if (!/^\+91\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Find an existing auth user with this phone, or create one.
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
      user_metadata: { full_name: body.full_name ?? body.store_name },
    });
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    userId = created.user!.id;
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({ role: "seller", full_name: body.full_name ?? undefined })
    .eq("id", userId);
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  const { data: seller, error: sellerErr } = await service
    .from("sellers")
    .upsert(
      {
        owner_id: userId,
        store_name: body.store_name,
        status: "approved",
        city: body.city || null,
        pincode: body.pincode || null,
        address_line: body.address_line || null,
        phone: phone.replace("+", ""),
      },
      { onConflict: "owner_id" }
    )
    .select()
    .single();
  if (sellerErr) return NextResponse.json({ error: sellerErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, seller_id: seller.id, phone });
});
