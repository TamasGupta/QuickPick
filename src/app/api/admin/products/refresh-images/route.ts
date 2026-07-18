import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { fetchProductImage, isImageReachable, mapWithConcurrency } from "@/lib/productImage";
import { withApiLogging } from "@/lib/apiLogger";

export const maxDuration = 60;

// POST /api/admin/products/refresh-images — re-checks auto-fetched product
// images for broken links and tries to find a replacement. Only touches
// image_source='auto' rows; seller-uploaded images are never overwritten.
// Concurrency is kept low because Open Food Facts rate-limits anonymous
// requests hard — firing many in parallel makes them ALL fail at once.
const BATCH_LIMIT = 60;
const CONCURRENCY = 3;

export const POST = withApiLogging("/api/admin/products/refresh-images", async (_req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireAdmin(supabase, user))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const service = createServiceSupabase();

  // Oldest-checked first, so repeated runs eventually cover the whole catalog.
  const { data: products, error } = await service
    .from("products")
    .select("id, name, brand, image_url")
    .eq("image_source", "auto")
    .not("image_url", "is", null)
    .order("image_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = products ?? [];
  let checked = 0;
  let fixed = 0;
  let cleared = 0;
  const now = new Date().toISOString();

  await mapWithConcurrency(list, CONCURRENCY, async (p) => {
    checked++;
    const ok = await isImageReachable(p.image_url as string);
    if (ok) {
      await service.from("products").update({ image_checked_at: now }).eq("id", p.id);
      return;
    }
    // Broken — try to find a replacement before giving up.
    const replacement = await fetchProductImage(p.name, p.brand);
    if (replacement) {
      fixed++;
      await service
        .from("products")
        .update({ image_url: replacement, image_checked_at: now })
        .eq("id", p.id);
    } else {
      cleared++;
      await service
        .from("products")
        .update({ image_url: null, image_source: null, image_checked_at: now })
        .eq("id", p.id);
    }
  });

  return NextResponse.json({ checked, fixed, cleared, remaining: list.length === BATCH_LIMIT });
});
