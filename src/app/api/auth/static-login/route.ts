import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { toE164 } from "@/lib/phone";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/auth/static-login — TEMPORARY stand-in for real SMS OTP delivery.
//
// While the SMS provider (Twilio/MSG91) isn't delivering, this lets any
// phone number log in using one shared static code instead of a real OTP.
//
// ⚠️ SECURITY: while enabled, anyone who knows STATIC_OTP_CODE can log in as
// ANY phone number — including existing seller/rider/admin accounts. Only
// keep STATIC_OTP_ENABLED=true while actively testing, and turn it off (unset
// the env var, redeploy) the moment real SMS delivery works.
export const POST = withApiLogging("/api/auth/static-login", async (req: Request) => {
  if (process.env.NEXT_PUBLIC_STATIC_OTP_ENABLED !== "true") {
    return NextResponse.json({ error: "Static OTP login is disabled" }, { status: 404 });
  }
  const staticCode = process.env.STATIC_OTP_CODE;
  if (!staticCode) {
    return NextResponse.json({ error: "Static OTP is not configured" }, { status: 500 });
  }

  const { phone: rawPhone, code } = (await req.json().catch(() => ({}))) as {
    phone?: string;
    code?: string;
  };
  if (!rawPhone || !code) {
    return NextResponse.json({ error: "phone and code required" }, { status: 400 });
  }
  if (code !== staticCode) {
    return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
  }

  const phone = toE164(rawPhone);
  if (!/^\+91\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Find or create the auth user for this phone.
  const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existing = list.users.find((u) => u.phone === phone.replace("+", ""));

  // A random per-request password lets us mint a real session via the
  // RLS-bound client below without ever exposing a guessable credential.
  const tempPassword = randomUUID();

  let userId: string;
  if (existing) {
    userId = existing.id;
    // The phone may exist but be unconfirmed (e.g. a real OTP was requested
    // once but SMS delivery failed before the user could verify it).
    const { error } = await service.auth.admin.updateUserById(userId, {
      password: tempPassword,
      phone_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: created, error } = await service.auth.admin.createUser({
      phone,
      phone_confirm: true,
      password: tempPassword,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    userId = created.user!.id;
  }

  const supabase = createServerSupabase();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ phone, password: tempPassword });
  if (signInErr) return NextResponse.json({ error: signInErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
});
