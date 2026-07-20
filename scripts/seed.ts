/**
 * Seed script — creates a demo seller + sample products so you can browse the
 * catalog immediately after setup.
 *
 * Usage:
 *   1. Fill .env.local (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   2. Run the SQL in supabase/schema.sql
 *   3. npm run seed
 *
 * It creates an auth user demo-seller@quickpick.test (password: quickpick123),
 * an approved seller store, and imports public/sample-products.csv.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

// Standalone scripts (unlike Next.js) don't auto-load .env.local — do it here.
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const email = "demo-seller@quickpick.test";
  const password = "quickpick123";

  // 1) Create (or fetch) the demo auth user.
  let userId: string;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Demo Seller" },
  });
  if (createErr && !createErr.message.includes("already")) throw createErr;
  if (created?.user) {
    userId = created.user.id;
  } else {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)!.id;
  }
  console.log("Demo user:", userId);

  // 2) Ensure profile is a seller.
  await admin.from("profiles").upsert({ id: userId, role: "seller", full_name: "Demo Seller" });

  // 3) Create approved seller store.
  const { data: seller } = await admin
    .from("sellers")
    .upsert(
      { owner_id: userId, store_name: "GrabOn Demo Store", status: "approved", city: "Bengaluru", pincode: "560001" },
      { onConflict: "owner_id" }
    )
    .select()
    .single();
  console.log("Seller store:", seller!.id);

  // 4) Load categories map.
  const { data: cats } = await admin.from("categories").select("id, name");
  const catMap = new Map((cats ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  // 5) Import sample CSV.
  const csv = fs.readFileSync(path.join(process.cwd(), "public", "sample-products.csv"), "utf-8");
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });

  const rows = parsed.data.map((r) => ({
    seller_id: seller!.id,
    name: r.name,
    brand: r.brand || null,
    category_id: catMap.get((r.category || "").toLowerCase()) ?? null,
    price: Number(r.price),
    mrp: r.mrp ? Number(r.mrp) : null,
    unit: r.unit || "unit",
    stock: Number(r.stock || 0),
    sku: r.sku || null,
    image_url: r.image_url || null,
    description: r.description || null,
    is_active: true,
  }));

  // Clear this demo seller's products first so re-seeding is idempotent
  // (avoids relying on an ON CONFLICT target).
  await admin.from("products").delete().eq("seller_id", seller!.id);
  const { error } = await admin.from("products").insert(rows);
  if (error) throw error;

  console.log(`Seeded ${rows.length} products.`);
  console.log(`\nLogin as the demo seller:\n  email: ${email}\n  password: ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
