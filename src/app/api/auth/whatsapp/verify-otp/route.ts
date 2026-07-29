import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { toE164 } from "@/lib/phone";
import { verifyOtp } from "@/lib/otp";
import { authRatelimit } from "@/lib/rateLimit";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/auth/whatsapp/verify-otp — verifies the per-user code sent via
// WhatsApp, then mints a real Supabase session using the exact same trick
// static-login uses: find-or-create the auth user for this phone, set a
// throwaway random password server-side, sign in with it. Supabase's phone
// provider has no WhatsApp channel, so there's no verifyOtp() call to
// delegate to here — this *is* the verification, backed by lib/otp.ts
// instead of Supabase's own OTP store.
export const POST = withApiLogging(
  "/api/auth/whatsapp/verify-otp",
  async (req: Request) => {
    const { phone: rawPhone, code } = (await req.json().catch(() => ({}))) as {
      phone?: string;
      code?: string;
    };
    if (!rawPhone || !code) {
      return NextResponse.json({ error: "phone and code required" }, { status: 400 });
    }

    const phone = toE164(rawPhone);
    if (!/^\+91\d{10}$/.test(phone)) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
    }

    // Rate-limit verify attempts per phone too — otherwise the 6-digit code
    // space is brute-forceable within its 5 minute TTL from a single IP
    // rotated across many requests, or a single well-behaved IP just
    // guessing repeatedly.
    const { success } = await authRatelimit.limit(`whatsapp-verify:${phone}`);
    if (!success) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }

    const valid = await verifyOtp(phone, code);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect or expired code" }, { status: 401 });
    }

    const service = createServiceSupabase();

    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    const existing = list.users.find((u) => u.phone === phone.replace("+", ""));

    // A random per-request password lets us mint a real session via the
    // RLS-bound client below without ever exposing a guessable credential.
    const tempPassword = randomUUID();

    let userId: string;
    if (existing) {
      userId = existing.id;
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
  },
  { rateLimit: "auth" }
);
