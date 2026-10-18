import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { invalidateSettingsCache } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
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

  const productId = params.id;
  if (!productId) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { error } = await service
    .from("product_restrictions")
    .delete()
    .eq("product_id", productId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear max_order_qty on products table if present
  try {
    await service.from("products").update({ max_order_qty: null }).eq("id", productId);
  } catch {
    // ignore
  }

  invalidateSettingsCache();
  try {
    revalidatePath("/api/settings");
  } catch {
    // ignore outside request context
  }

  return NextResponse.json({ success: true });
}
