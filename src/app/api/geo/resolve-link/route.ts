import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/apiLogger";
import { resolveMapsLink } from "@/lib/reverseGeocode";

// POST /api/geo/resolve-link — {url} -> {lat, lng, city, state, pincode}.
// Runs server-side because shortened maps.app.goo.gl links only reveal
// coordinates after their redirect is followed, which browser fetch() can't
// do cross-origin, and because Nominatim has no CORS headers for client use.
export const POST = withApiLogging("/api/geo/resolve-link", async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { url } = body as { url?: string };
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const result = await resolveMapsLink(url);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result);
});
