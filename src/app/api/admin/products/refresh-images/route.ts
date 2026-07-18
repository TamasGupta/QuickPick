import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { fetchProductImage, isImageReachable, mapWithConcurrency } from "@/lib/productImage";
import { withApiLogging } from "@/lib/apiLogger";

export const maxDuration = 60;

// POST /api/admin/products/refresh-images — two jobs in one pass, both
// scoped to never touch seller-uploaded images:
//   1. Backfill: products with no image at all (never fetched, or a seller
//      simply didn't provide one) get a fresh lookup.
//   2. Recheck: previously auto-fetched images get link-checked, and a
//      broken one gets a replacement lookup.
// A product can only reach this route with image_url=null if it also has no
// seller-set image_source (see /api/upload/import), so querying on
// image_url alone can't accidentally overwrite a seller's photo.
// Batch size and concurrency are kept low because a lookup goes through
// Apify's Google Images Scraper, which is slow (real browser per query) and
// billed per-use, unlike the old free Open Food Facts lookup.
const BATCH_LIMIT = 20;
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
    .select("id, name, brand, unit, image_url")
    .or("image_url.is.null,image_source.eq.auto")
    .order("image_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = products ?? [];
  let checked = 0;
  let filled = 0;
  let fixed = 0;
  let cleared = 0;
  const now = new Date().toISOString();

  await mapWithConcurrency(list, CONCURRENCY, async (p) => {
    checked++;

    if (!p.image_url) {
      // Never had one — straight lookup, nothing to link-check.
      const found = await fetchProductImage(p.name, p.brand, p.unit);
      if (found) {
        filled++;
        await service
          .from("products")
          .update({ image_url: found, image_source: "auto", image_checked_at: now })
          .eq("id", p.id);
      } else {
        await service.from("products").update({ image_checked_at: now }).eq("id", p.id);
      }
      return;
    }

    const ok = await isImageReachable(p.image_url);
    if (ok) {
      await service.from("products").update({ image_checked_at: now }).eq("id", p.id);
      return;
    }
    // Broken — try to find a replacement before giving up.
    const replacement = await fetchProductImage(p.name, p.brand, p.unit);
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

  return NextResponse.json({ checked, filled, fixed, cleared, remaining: list.length === BATCH_LIMIT });
});
