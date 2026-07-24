import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const sellerId = "44e5485e-4b8d-4eb1-8117-28d64d38e8eb";

  const { data: seller } = await s.from("sellers").select("id, store_name, timezone").eq("id", sellerId).single();
  console.log("SELLER:", seller);

  const { data: hours } = await s.from("store_hours").select("*").eq("seller_id", sellerId).order("day_of_week");
  console.log("STORE HOURS ROWS:", hours);

  const { data: isOpen, error } = await s.rpc("is_store_open", { p_seller_id: sellerId });
  console.log("IS_STORE_OPEN RPC RESULT:", isOpen, "ERROR:", error);
}

main().catch(console.error);
