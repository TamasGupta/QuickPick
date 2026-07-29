/**
 * Provisions (or promotes) a super admin account by email.
 *
 * Usage:
 *   npm run create-admin -- admin@example.com "Admin Name"
 *
 * The email is confirmed immediately (no OTP needed for this one-time setup
 * step) — the admin then logs in normally via email+OTP like everyone else.
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
    console.error('Usage: npm run create-admin -- <email> "Name"');
    process.exit(1);
  }
  const email = raw.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    console.error("Enter a valid email address.");
    process.exit(1);
  }

  let userId: string;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    // The email may exist but be unconfirmed (e.g. a real OTP was requested
    // once but never completed).
    await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    console.log("Found existing user:", userId);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log("Created new user:", userId);
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role: "admin", full_name: name, email })
    .eq("id", userId);
  if (profileErr) throw profileErr;

  console.log(`\n${email} is now a super admin. Log in via email+OTP as usual — you'll land on /admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
