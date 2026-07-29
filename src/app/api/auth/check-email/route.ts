import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// POST /api/auth/check-email — does an account with this email already
// exist? Used by both login (must exist) and register (must not exist).
// Mirrors the retired check-phone route's structure, just keyed on email —
// see migration 018 for why auth moved from phone to email.
export const POST = withApiLogging(
  "/api/auth/check-email",
  async (req: Request) => {
    const { email: rawEmail } = (await req.json().catch(() => ({}))) as { email?: string };
    if (!rawEmail) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const service = createServiceSupabase();

    // 1. Check profiles table
    const { data: profiles, error: profileErr } = await service
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .limit(10);

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const existingProfile = profiles?.find((p) => p.full_name && p.full_name.trim().length > 0);
    if (existingProfile) {
      return NextResponse.json({ exists: true });
    }

    // 2. Check auth.users table — covers a user who verified once but never
    // finished setting a name (profiles.email could be null/stale for them).
    const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 200 });
    if (!listErr && list?.users) {
      const existingAuthUser = list.users.find((u) => u.email?.toLowerCase() === email);

      if (existingAuthUser) {
        const { data: userProfile } = await service
          .from("profiles")
          .select("full_name")
          .eq("id", existingAuthUser.id)
          .maybeSingle();

        if (userProfile?.full_name && userProfile.full_name.trim().length > 0) {
          return NextResponse.json({ exists: true });
        }
      }
    }

    return NextResponse.json({ exists: false });
  },
  { rateLimit: "auth" }
);
