import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/apiLogger";
import { reverseGeocode } from "@/lib/reverseGeocode";

// POST /api/geo/reverse — {lat, lng} -> {city, state, pincode}. Used right
// after browser geolocation returns coordinates, so forms can auto-fill
// city/state/pincode instead of only capturing raw lat/lng.
export const POST = withApiLogging("/api/geo/reverse", async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { lat, lng } = body as { lat?: number; lng?: number };
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  const addr = await reverseGeocode(lat, lng);
  if (!addr) return NextResponse.json({ error: "Couldn't resolve that location" }, { status: 502 });
  return NextResponse.json(addr);
});
