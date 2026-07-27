import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// PUT /api/addresses/:id — update an address
export const PUT = withApiLogging(
  "/api/addresses/[id]",
  async (req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { label, line1, line2, city, state, pincode, lat, lng, is_default } = await req.json();

    // Verify ownership
    const { data: address } = await supabase
      .from("addresses")
      .select("user_id")
      .eq("id", params.id)
      .single();

    if (!address || address.user_id !== user.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    // If marking as default, unset other defaults
    if (is_default) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    }

    const { data: updated, error } = await supabase
      .from("addresses")
      .update({
        label,
        line1,
        line2,
        city,
        state,
        pincode,
        lat,
        lng,
        is_default,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ address: updated });
  }
);

// DELETE /api/addresses/:id — delete an address
export const DELETE = withApiLogging(
  "/api/addresses/[id]",
  async (_req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Verify ownership
    const { data: address } = await supabase
      .from("addresses")
      .select("user_id, is_default")
      .eq("id", params.id)
      .single();

    if (!address || address.user_id !== user.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const { error } = await supabase.from("addresses").delete().eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If was default, mark the most recent address as default
    if (address.is_default) {
      const { data: newest } = await supabase
        .from("addresses")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (newest) {
        await supabase.from("addresses").update({ is_default: true }).eq("id", newest.id);
      }
    }

    return NextResponse.json({ ok: true });
  }
);
