import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const TEST_PHONES = [
  { phone: "+919876543210", name: "Test Buyer 1", role: "buyer" },
  { phone: "+919876543211", name: "Test Buyer 2", role: "buyer" },
  { phone: "+919876543212", name: "Test Seller 1", role: "seller" },
  { phone: "+919876543213", name: "Test Seller 2", role: "seller" },
  { phone: "+919876543214", name: "Test Rider 1", role: "rider" },
  { phone: "+919876543215", name: "Test Rider 2", role: "rider" },
];

async function main() {
  console.log("Creating test users with phone numbers...\n");

  for (const testUser of TEST_PHONES) {
    const phone = testUser.phone;

    // Check if user already exists
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    const existing = list.users.find((u) => u.phone === phone.replace('+', ''));

    let userId: string;
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { phone_confirm: true });
      console.log(`Updated existing user ${testUser.name} (${phone}): ${userId}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password: "Test@1234",
        user_metadata: { full_name: testUser.name },
      });
      if (error) throw error;
      userId = data.user.id;
      console.log(`Created new ${testUser.role} ${testUser.name} (${phone}): ${userId}`);
    }

    // Ensure profile exists with correct role
    await admin.from("profiles").upsert({
      id: userId,
      role: testUser.role,
      full_name: testUser.name,
    });

    // Add delivery address for buyers
    if (testUser.role === "buyer") {
      const { data: addrs } = await admin.from("addresses").select("id").eq("user_id", userId);
      if (!addrs?.[0]) {
        await admin.from("addresses").insert({
          user_id: userId,
          label: "Home",
          line1: "123 Test Street",
          city: "Mumbai",
          pincode: "400001",
        });
        console.log(`  → Created delivery address`);
      }
    }

    // Create seller store for sellers
    if (testUser.role === "seller") {
      const { data: seller } = await admin
        .from("sellers")
        .upsert(
          { owner_id: userId, store_name: `${testUser.name} Store`, status: "approved", city: "Bengaluru", pincode: "560001" },
          { onConflict: "owner_id" }
        )
        .select()
        .single();
      if (seller) console.log(`  → Created seller store: ${seller.id}`);
    }
  }

  console.log("\n✅ Test users created!");
  console.log("\nTest phone numbers (all use OTP: 123456 or check Redis for actual):");
  for (const u of TEST_PHONES) {
    console.log(`  ${u.phone} — ${u.name} (${u.role})`);
  }
  console.log("\nNote: OTPs are stored in Redis with 5-min TTL. For testing, use the /api/auth/whatsapp/send-otp endpoint then check Redis, or use the static login with phone + password 'Test@1234' if email/password auth is enabled.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});