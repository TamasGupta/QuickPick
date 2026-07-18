// Turns raw coordinates (from GPS or a resolved Maps link) into city/state/
// pincode, and resolves a pasted Google Maps link to coordinates. Server-only:
// Nominatim has no CORS headers for browser fetches, and following redirects
// on a shortened maps.app.goo.gl link needs a real server-side request anyway.
//
// Nominatim (OpenStreetMap) is free and keyless — same "use the free public
// API, degrade gracefully on failure" approach as lib/productImage.ts.
// Its usage policy requires a descriptive User-Agent and asks for at most
// ~1 request/sec, which fits this app's low-volume, human-triggered lookups.

const USER_AGENT = "QuickPick/1.0 (quick-commerce delivery app; contact: naitik@techind.co)";
const FETCH_TIMEOUT_MS = 6000;

export interface ResolvedLocation {
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
}

// GET /reverse — coordinates -> city/state/pincode.
export async function reverseGeocode(lat: number, lng: number): Promise<Omit<ResolvedLocation, "lat" | "lng"> | null> {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      addressdetails: "1",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress };
    const a = data.address;
    if (!a) return null;
    return {
      city: a.city || a.town || a.village || a.suburb || null,
      state: a.state || null,
      pincode: a.postcode || null,
    };
  } catch {
    return null;
  }
}

// Only ever follow/fetch Google's own domains — this endpoint takes a
// user-supplied URL, so without an allowlist it'd be an open SSRF proxy.
const ALLOWED_HOSTS = ["google.com", "goo.gl", "app.goo.gl"];

function isAllowedMapsHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

const COORD_PATTERNS = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/];

function extractCoords(url: string): { lat: number; lng: number } | null {
  for (const re of COORD_PATTERNS) {
    const m = url.match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

// Resolves a pasted Google Maps link (including shortened maps.app.goo.gl /
// goo.gl/maps links, which contain no coordinates until followed) down to
// lat/lng, then reverse-geocodes those into city/state/pincode.
export async function resolveMapsLink(rawUrl: string): Promise<ResolvedLocation | { error: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: "That doesn't look like a valid link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Only http(s) links are supported." };
  }
  if (!isAllowedMapsHost(url.hostname)) {
    return { error: "Please paste a Google Maps link (google.com or goo.gl)." };
  }

  let finalUrl = rawUrl;
  try {
    // fetch() follows redirects by default and exposes the final URL, which
    // is exactly how a shortened link expands into one containing coordinates.
    const res = await fetch(rawUrl, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    finalUrl = res.url || rawUrl;
  } catch {
    return { error: "Couldn't open that link — check it's correct and try again." };
  }

  const coords = extractCoords(finalUrl);
  if (!coords) {
    return {
      error: "Couldn't find coordinates in that link. Open it in Google Maps, drop a pin on the exact spot, then Share → Copy link.",
    };
  }

  const addr = await reverseGeocode(coords.lat, coords.lng);
  return { ...coords, city: addr?.city ?? null, state: addr?.state ?? null, pincode: addr?.pincode ?? null };
}
