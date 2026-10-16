import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { getProductRestrictionsList, invalidateSettingsCache } from "@/lib/settings";

export const dynamic = "force-dynamic";

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

  const restrictions = await getProductRestrictionsList();
  return NextResponse.json({ restrictions });
}

export async function POST(req: Request) {
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
  const { product_id, max_qty } = body as { product_id: string; max_qty: number };

  if (!product_id || typeof max_qty !== "number" || max_qty <= 0) {
    return NextResponse.json(
      { error: "Invalid payload: product_id and a positive max_qty are required." },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();

  // Verify product exists
  const { data: product, error: pErr } = await service
    .from("products")
    .select("id, name")
    .eq("id", product_id)
    .single();

  if (pErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Upsert into product_restrictions
  const { data, error } = await service
    .from("product_restrictions")
    .upsert({
      product_id,
      max_qty: Math.floor(max_qty),
      updated_at: new Date().toISOString(),
    })
    .select(`
      product_id,
      max_qty,
      created_at,
      updated_at,
      products (
        id,
        name,
        price,
        stock,
        image_url,
        unit,
        brand,
        sellers (
          store_name
        )
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also sync max_order_qty on products table if column exists (ignore error if not yet migrated)
  try {
    await service.from("products").update({ max_order_qty: Math.floor(max_qty) }).eq("id", product_id);
  } catch {
    // ignore if column doesn't exist
  }

  invalidateSettingsCache();

  return NextResponse.json({ restriction: data });
}
