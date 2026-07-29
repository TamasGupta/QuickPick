// Auto-fetches product photos via Apify's Google Images Scraper actor —
// searches Google Images for "<brand> <name>" and takes the best-looking
// result. Requires APIFY_API_TOKEN (server-only secret; never exposed to the
// client — do NOT prefix it with NEXT_PUBLIC_).
//
// Every lookup is best-effort: a missing token, network failure, timeout, or
// no results all resolve to `null` so callers fall back to the placeholder
// icon rather than ever showing a wrong or broken image.
//
// Unlike a curated database (the old Open Food Facts lookup), raw Google
// Images results are noisy — confirmed live: the same query returned a
// legitimate Amazon product photo on one run and an unrelated AI-generated
// blog image on another. So results are only trusted if they come from a
// known retail/product domain; anything else is treated as no match at all
// rather than risking a wrong photo on a live storefront.
//
// Results are cached in `product_image_cache` (brand+name+unit -> image_url)
// because Apify is slow and billed per call, but many sellers list the same
// national-brand SKU — a lookup only ever hits Apify once app-wide, every
// later import for the same product reads the cache instead. Cache is an
// exact-normalized-string match: it won't recognize "Amul Gold Full Cream
// Milk" and "Amul Full Cream Milk Gold" as the same product, but that's an
// acceptable gap for the cost/latency it saves on true repeats.
import { createServiceSupabase } from "@/lib/supabase/server";

const APIFY_ACTOR = "hooli~google-images-scraper";
const APIFY_RUN_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;
// Apify spins up a real headless browser to scrape Google Images per call —
// far slower than a plain JSON API (the old Open Food Facts lookup). Give it
// real time to finish instead of timing out mid-run.
const FETCH_TIMEOUT_MS = 30000;
const MAX_RESULTS_PER_QUERY = 10;
// Skip tiny thumbnails/icons in favor of an actual product photo.
const MIN_USABLE_WIDTH = 200;

// Retail/product-listing domains whose "product photo" is actually reliable.
// Deliberately an allowlist, not a blocklist — blocklists can't keep up with
// the long tail of spam/AI-image sites Google Images surfaces.
const TRUSTED_DOMAINS = [
  "amazon.",
  "walmart.com",
  "ebay.com",
  "target.com",
  "flipkart.com",
  "bigbasket.com",
  "jiomart.com",
  "blinkit.com",
  "zeptonow.com",
  "instacart.com",
  "kroger.com",
  "costco.com",
  "dmart.in",
  "myshopify.com",
];

interface ApifyImageResult {
  imageUrl?: string;
  imageWidth?: number;
  origin?: string;
  contentUrl?: string;
  title?: string;
}

function isTrustedSource(item: ApifyImageResult): boolean {
  const host = item.origin ?? item.contentUrl ?? "";
  return TRUSTED_DOMAINS.some((d) => host.includes(d));
}

// Google Images returns SOME result for almost any input, including
// nonsense — confirmed live: a garbage query still matched a real Walmart
// product photo, which is worse than no photo (wrong item on a real
// storefront). Require the result's page title to actually mention a
// significant word from the query, so unrelated matches get rejected instead
// of silently attached to the wrong product.
function isRelevant(item: ApifyImageResult, query: string): boolean {
  const title = (item.title ?? "").toLowerCase();
  if (!title) return false;
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  return words.some((w) => title.includes(w));
}

// How long a cached "no match" is trusted before retrying Apify — a miss
// might just mean noisy Google results that day, so it's worth another shot
// eventually, but retrying every single import would defeat the cache.
const CACHE_MISS_RETRY_DAYS = 14;

// Exported so a seller's manual photo upload (see /api/products/[id]/image)
// can write into the same cache under the same normalization — a real,
// verified product photo is more trustworthy than a scraped Google Images
// result, so it should pre-empt Apify for every other seller listing the
// same brand+name+unit from here on.
export function cacheKeyFor(name: string, brand?: string | null, unit?: string | null): string {
  const sizeHint = unit && unit.toLowerCase() !== "unit" ? unit : null;
  return [brand, name, sizeHint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function runApifySearch(query: string, token: string): Promise<string | null> {
  const res = await fetch(`${APIFY_RUN_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries: [query], maxResultsPerQuery: MAX_RESULTS_PER_QUERY }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const items = (await res.json()) as ApifyImageResult[];
  const match = items.find(
    (i) => i.imageUrl && (i.imageWidth ?? 0) >= MIN_USABLE_WIDTH && isTrustedSource(i) && isRelevant(i, query)
  );
  return match?.imageUrl ?? null;
}

export async function fetchProductImage(
  name: string,
  brand?: string | null,
  unit?: string | null
): Promise<string | null> {
  // Pack size matters: retail listing titles almost always include it
  // ("Maggi Noodles Masala, 70 grams"), and without it a search can just as
  // easily match a different pack size's photo — wrong for a live storefront
  // even if it's the right product. Skip the generic default unit ("unit")
  // some rows fall back to, since that's not a real size.
  const sizeHint = unit && unit.toLowerCase() !== "unit" ? unit : null;
  const query = [brand, name, sizeHint].filter(Boolean).join(" ").trim();
  if (!query) return null;

  const cacheKey = cacheKeyFor(name, brand, unit);
  const service = createServiceSupabase();

  const { data: cached } = await service
    .from("product_image_cache")
    .select("image_url, checked_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) {
    if (cached.image_url) return cached.image_url;
    const ageMs = Date.now() - new Date(cached.checked_at).getTime();
    if (ageMs < CACHE_MISS_RETRY_DAYS * 24 * 60 * 60 * 1000) return null;
  }

  // No token configured — nothing was actually attempted, so don't write a
  // cache entry (that would wrongly look like a confident "no match").
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  try {
    const result = await runApifySearch(query, token);
    // Only cache a real response (hit or confident miss) — never cache a
    // network failure/timeout as a permanent "no image", that'd wrongly
    // block every future retry for a product that was never actually looked up.
    await service
      .from("product_image_cache")
      .upsert({ cache_key: cacheKey, image_url: result, checked_at: new Date().toISOString() }, { onConflict: "cache_key" });
    return result;
  } catch {
    return null;
  }
}

// HEAD-checks whether a previously stored image URL still resolves.
export async function isImageReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Runs `fn` over `items` with at most `limit` in flight at once — keeps a
// bulk import's worth of external lookups from either serializing (too slow)
// or firing all at once.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
