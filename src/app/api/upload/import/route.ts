import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { fetchProductImage, mapWithConcurrency } from "@/lib/productImage";
import type { ParsedProductRow } from "@/lib/types";

// Cap how many auto-image lookups one import triggers, so a huge catalog
// upload can't blow the route's time budget — the rest simply import without
// a photo, same as today, and can be backfilled later by the recheck job.
// Concurrency is kept low because Open Food Facts rate-limits anonymous
// requests hard — firing many in parallel makes them ALL fail at once.
const MAX_AUTO_IMAGE_LOOKUPS = 40;
const IMAGE_LOOKUP_CONCURRENCY = 3;

export const maxDuration = 60;

// POST /api/upload/import — persist confirmed rows as products for the
// seller. Only rows with no validation errors are imported. Categories are
// resolved by name (created if missing). Batched inserts for scale.
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { rows, fileName, fileType } = (await req.json()) as {
    rows: ParsedProductRow[];
    fileName?: string;
    fileType?: string;
  };

  // Resolve this user's seller record.
  const { data: seller } = await supabase
    .from("sellers")
    .select("id, status")
    .eq("owner_id", user.id)
    .single();
  if (!seller) {
    return NextResponse.json(
      { error: "Create your seller store before uploading products." },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();

  // Build category name → id map (create missing).
  const { data: cats } = await service.from("categories").select("id, name");
  const catMap = new Map<string, string>(
    (cats ?? []).map((c) => [c.name.toLowerCase(), c.id])
  );
  const neededCats = new Set(
    rows
      .map((r) => r.category?.trim())
      .filter((c): c is string => !!c && !catMap.has(c.toLowerCase()))
  );
  for (const name of neededCats) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data } = await service
      .from("categories")
      .insert({ name, slug })
      .select("id, name")
      .single();
    if (data) catMap.set(data.name.toLowerCase(), data.id);
  }

  const valid = rows.filter((r) => r._errors.length === 0 && r.name && r.price !== null);
  const errored = rows.filter((r) => r._errors.length > 0);

  // Auto-fetch a photo (from Open Food Facts) for rows the seller didn't
  // supply an image for — bounded so one huge upload can't time out the
  // route; any rows past the cap just import without a photo for now.
  const needsImage = valid.filter((r) => !r.image_url).slice(0, MAX_AUTO_IMAGE_LOOKUPS);
  const fetchedImages = await mapWithConcurrency(needsImage, IMAGE_LOOKUP_CONCURRENCY, (r) =>
    fetchProductImage(r.name, r.brand)
  );
  const autoImageByName = new Map(needsImage.map((r, i) => [r, fetchedImages[i]]));

  const now = new Date().toISOString();
  const payload = valid.map((r) => {
    const autoImage = autoImageByName.get(r);
    // `||` (not `??`) — a parsed empty-string image_url must fall through to
    // the auto-fetched one; `??` only treats null/undefined as "absent".
    const image_url = r.image_url || autoImage || null;
    return {
      seller_id: seller.id,
      name: r.name,
      description: r.description ?? null,
      category_id: r.category ? catMap.get(r.category.toLowerCase()) ?? null : null,
      price: r.price,
      mrp: r.mrp ?? null,
      unit: r.unit ?? "unit",
      stock: r.stock ?? 0,
      sku: r.sku ?? null,
      image_url,
      image_source: r.image_url ? "seller" : autoImage ? "auto" : null,
      image_checked_at: autoImage ? now : null,
      brand: r.brand ?? null,
      is_active: true,
    };
  });

  // Batch inserts (500/batch) for large catalogs.
  let imported = 0;
  const BATCH = 500;
  for (let i = 0; i < payload.length; i += BATCH) {
    const chunk = payload.slice(i, i + BATCH);
    const { error, count } = await service
      .from("products")
      .upsert(chunk, { onConflict: "seller_id,sku", ignoreDuplicates: false, count: "exact" });
    if (error) {
      return NextResponse.json({ error: error.message, imported }, { status: 500 });
    }
    imported += count ?? chunk.length;
  }

  // Audit trail.
  await service.from("upload_jobs").insert({
    seller_id: seller.id,
    file_name: fileName ?? null,
    file_type: fileType ?? null,
    status: "completed",
    total_rows: rows.length,
    imported,
    errors: errored.map((r) => ({ row: r._rowIndex, name: r.name, errors: r._errors })),
  });

  return NextResponse.json({
    imported,
    skipped: errored.length,
    total: rows.length,
  });
}
