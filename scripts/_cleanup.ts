import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
async function main() {
  await admin.from("orders").update({ status: "placed", rider_id: null }).eq("id", "20654647-c426-4f13-a726-3aca53e6935f");
  await admin.auth.admin.updateUserById("fb8222b9-b124-4485-895b-128da3d54293", { phone: "" });
  console.log("cleaned up test order + rider phone");
}
main();
