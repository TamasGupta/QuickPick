import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";
import type { Address } from "@/lib/types";

// GET /api/addresses — fetch all addresses for the current user
export const GET = withApiLogging("/api/addresses", async (_req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: addresses, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ addresses: addresses ?? [] });
});

// POST /api/addresses — create a new address
export const POST = withApiLogging("/api/addresses", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label, line1, line2, city, state, pincode, lat, lng, is_default } = await req.json();

  if (!line1 || !pincode) {
    return NextResponse.json(
      { error: "Address line and pincode are required" },
      { status: 400 }
    );
  }

  // If marking as default, unset other defaults
  if (is_default) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data: address, error } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      label: label ?? "Home",
      line1,
      line2,
      city,
      state,
      pincode,
      lat,
      lng,
      is_default: is_default ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ address }, { status: 201 });
});
