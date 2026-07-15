/**
 * Provisions (or promotes) a super admin account by phone number.
 *
 * Usage:
 *   npm run create-admin -- 9876543210 "Admin Name"
 *
 * The phone is confirmed immediately (no OTP needed for this one-time setup
 * step) — the admin then logs in normally via phone+OTP like everyone else.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const raw = process.argv[2];
  const name = process.argv[3] || "Admin";
  if (!raw) {
    console.error('Usage: npm run create-admin -- <10-digit-phone> "Name"');
    process.exit(1);
  }
  const digits = raw.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    console.error("Enter a valid 10-digit Indian mobile number.");
    process.exit(1);
  }
  const phone = `+91${digits}`;

  let userId: string;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  // Supabase stores phone as E.164 without the leading "+" (e.g. "919876543210").
  const existing = list.users.find((u) => u.phone === phone.replace("+", ""));
  if (existing) {
    userId = existing.id;
    // The phone may exist but be unconfirmed (e.g. a real OTP was requested
    // once but SMS delivery failed before the user could verify it).
    await admin.auth.admin.updateUserById(userId, { phone_confirm: true });
    console.log("Found existing user:", userId);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log("Created new user:", userId);
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role: "admin", full_name: name })
    .eq("id", userId);
  if (profileErr) throw profileErr;

  console.log(`\n${phone} is now a super admin. Log in via phone+OTP as usual — you'll land on /admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
