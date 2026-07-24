import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const email = process.env.TEST_EMAIL || "loadtest@quickpick.com";
  const password = process.env.TEST_PASSWORD || "LoadTest@1234";

  console.log(`Checking if test user ${email} exists...`);
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  let userId: string;
  const existing = list.users.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    console.log(`Updated password for existing user (${email}): ${userId}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Load Test Buyer" },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created new buyer test user (${email}): ${userId}`);
  }

  // Ensure profile exists and has role 'buyer'
  await admin.from("profiles").upsert({
    id: userId,
    role: "buyer",
    full_name: "Load Test Buyer",
  });

  // Ensure test buyer has a valid delivery address
  const { data: addrs } = await admin.from("addresses").select("id").eq("user_id", userId);
  let addressId = addrs?.[0]?.id;

  if (!addressId) {
    const { data: newAddr, error: addrErr } = await admin.from("addresses").insert({
      user_id: userId,
      label: "Home",
      line1: "123 Test Street",
      city: "Mumbai",
      pincode: "400001",
    }).select().single();
    if (addrErr) throw addrErr;
    addressId = newAddr.id;
    console.log(`Created delivery address for test buyer: ${addressId}`);
  }

  // Get demo seller ID
  const { data: sellers } = await admin.from("sellers").select("id, store_name").eq("status", "approved").limit(1);
  const seller = sellers?.[0];

  console.log(`\n✅ Test setup complete! Use these exact UUIDs in load-tests/helpers/env.js:`);
  console.log(`   SELLER_ID  = "${seller?.id}"`);
  console.log(`   ADDRESS_ID = "${addressId}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
