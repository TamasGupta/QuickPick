import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/admin/sellers/create — super admin onboards a new seller.
// Creates (or reuses) the email-auth account, sets role='seller', and
// creates an approved store — sellers no longer self-register.
// phone is plain contact info (store's phone number), not the login
// identity — see migration 018 for why auth moved from phone to email.
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
    email?: string;
    phone?: string;
    full_name?: string;
    store_name?: string;
    city?: string;
    state?: string;
    pincode?: string;
    address_line?: string;
    lat?: number | null;
    lng?: number | null;
  };
  if (!body.email || !body.store_name) {
    return NextResponse.json({ error: "email and store_name are required" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const phoneDigits = body.phone ? body.phone.replace(/\D/g, "").slice(-10) : "";
  if (body.phone && phoneDigits.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }
  // Stored with the "91" prefix, no "+" — matches the format existing display
  // components (e.g. AdminRiderRow) still expect.
  const phoneStored = phoneDigits ? `91${phoneDigits}` : "";
  const phoneE164 = phoneDigits ? `+91${phoneDigits}` : undefined;

  const service = createServiceSupabase();

  // Find an existing auth user with this email or phone, or create one.
  let userId: string;
  const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existingByEmail = list.users.find((u) => u.email?.toLowerCase() === email);
  const existingByPhone = phoneDigits
    ? list.users.find((u) => u.phone === phoneStored || u.phone === phoneE164 || u.phone?.endsWith(phoneDigits))
    : undefined;

  const existing = existingByEmail || existingByPhone;
  if (existing) {
    userId = existing.id;
    await service.auth.admin.updateUserById(userId, {
      email_confirm: true,
      ...(phoneE164 ? { phone: phoneE164, phone_confirm: true } : {}),
      user_metadata: { ...existing.user_metadata, full_name: body.full_name ?? body.store_name },
    });
  } else {
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(phoneE164 ? { phone: phoneE164, phone_confirm: true } : {}),
      user_metadata: { full_name: body.full_name ?? body.store_name },
    });
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    userId = created.user!.id;
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({
      role: "seller",
      full_name: body.full_name ?? undefined,
      email,
      phone: phoneStored || undefined,
    })
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
        state: body.state || null,
        pincode: body.pincode || null,
        address_line: body.address_line || null,
        phone: phoneStored || null,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
      },
      { onConflict: "owner_id" }
    )
    .select()
    .single();
  if (sellerErr) return NextResponse.json({ error: sellerErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, seller_id: seller.id, email });
});
