import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/auth/static-login — TEMPORARY stand-in for real email OTP
// delivery.
//
// While email delivery isn't confirmed working end-to-end, this lets any
// email log in using one shared static code instead of a real OTP.
//
// ⚠️ SECURITY: while enabled, anyone who knows STATIC_OTP_CODE can log in as
// ANY email — including existing seller/rider/admin accounts. Only keep
// STATIC_OTP_ENABLED=true while actively testing, and turn it off (unset
// the env var, redeploy) the moment real email delivery is verified.
export const POST = withApiLogging("/api/auth/static-login", async (req: Request) => {
  if (process.env.NEXT_PUBLIC_STATIC_OTP_ENABLED !== "true") {
    return NextResponse.json({ error: "Static OTP login is disabled" }, { status: 404 });
  }
  const staticCode = process.env.STATIC_OTP_CODE;
  if (!staticCode) {
    return NextResponse.json({ error: "Static OTP is not configured" }, { status: 500 });
  }

  const { email: rawEmail, code } = (await req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
  };
  if (!rawEmail || !code) {
    return NextResponse.json({ error: "email and code required" }, { status: 400 });
  }
  if (code !== staticCode) {
    return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
  }

  const email = rawEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Find or create the auth user for this email.
  const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);

  // A random per-request password lets us mint a real session via the
  // RLS-bound client below without ever exposing a guessable credential.
  const tempPassword = randomUUID();

  let userId: string;
  if (existing) {
    userId = existing.id;
    // The email may exist but be unconfirmed (e.g. a real OTP was requested
    // once but the user never completed it).
    const { error } = await service.auth.admin.updateUserById(userId, {
      password: tempPassword,
      email_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: created, error } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      password: tempPassword,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    userId = created.user!.id;
  }

  const supabase = createServerSupabase();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: tempPassword });
  if (signInErr) return NextResponse.json({ error: signInErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, { rateLimit: "auth" });
