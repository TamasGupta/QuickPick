import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { getAppSettings, invalidateSettingsCache } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
  }

  const settings = await getAppSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const delivery_fee = Number(body.delivery_fee);
  const other_charges = Number(body.other_charges);
  const min_order_amount = Number(body.min_order_amount);
  const max_cart_items = Number(body.max_cart_items);
  const max_qty_per_product = Number(body.max_qty_per_product);

  if (
    isNaN(delivery_fee) || delivery_fee < 0 ||
    isNaN(other_charges) || other_charges < 0 ||
    isNaN(min_order_amount) || min_order_amount < 0 ||
    isNaN(max_cart_items) || max_cart_items <= 0 ||
    isNaN(max_qty_per_product) || max_qty_per_product <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid settings: values must be positive numbers." },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();

  const { data, error } = await service
    .from("app_settings")
    .upsert({
      id: "default",
      delivery_fee,
      other_charges,
      min_order_amount,
      max_cart_items,
      max_qty_per_product,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateSettingsCache();
  try {
    revalidatePath("/api/settings");
    revalidatePath("/cart");
    revalidatePath("/checkout");
  } catch {
    // ignore outside request context
  }

  return NextResponse.json({ settings: data });
}
