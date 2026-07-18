// Auto-fetches product photos from Open Food Facts — a free, crowdsourced
// grocery/FMCG product database whose images are CC-BY-SA licensed for
// exactly this kind of reuse (unlike scraping generic web/image search
// results, which carries real copyright risk and no quality guarantees).
//
// Every lookup is best-effort: network failures, timeouts, or no match all
// resolve to `null` so callers fall back to the placeholder icon rather than
// ever showing a wrong or broken image.

// NOTE: the newer /api/v2/search REST endpoint does NOT filter by
// `search_terms` (confirmed by testing — it silently ignores the param and
// returns arbitrary global results, which would have shown random/wrong
// product photos). The legacy /cgi/search.pl endpoint is still the correct,
// documented way to do free-text product search and actually filters.
const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const USER_AGENT = "QuickPick/1.0 (quick-commerce catalog; contact: support@quickpick.app)";
// Open Food Facts rate-limits anonymous requests fairly aggressively — firing
// several in parallel reliably trips a "temporarily unavailable" wall that
// makes every in-flight lookup fail at once. Keep timeouts short and callers
// low-concurrency (see mapWithConcurrency call sites).
const FETCH_TIMEOUT_MS = 3500;

interface OffProduct {
  product_name?: string;
  image_front_url?: string;
  image_url?: string;
}

export async function fetchProductImage(name: string, brand?: string | null): Promise<string | null> {
  const query = [brand, name].filter(Boolean).join(" ").trim();
  if (!query) return null;

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "5",
    fields: "product_name,image_front_url,image_url",
  });

  try {
    const res = await fetch(`${OFF_SEARCH_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { products?: OffProduct[] };
    const match = (data.products ?? []).find((p) => p.image_front_url || p.image_url);
    return match?.image_front_url || match?.image_url || null;
  } catch {
    return null;
  }
}

// HEAD-checks whether a previously stored image URL still resolves.
export async function isImageReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Runs `fn` over `items` with at most `limit` in flight at once — keeps a
// bulk import's worth of external lookups from either serializing (too slow)
// or firing all at once (rude to a free public API).
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
