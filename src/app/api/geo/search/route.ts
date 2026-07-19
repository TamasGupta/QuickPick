import { NextResponse } from "next/server";
import { withApiLogging } from "@/lib/apiLogger";
import { searchAddress } from "@/lib/reverseGeocode";

// GET /api/geo/search?q=... — free-text address -> candidate points, for the
// map picker's search box.
export const GET = withApiLogging("/api/geo/search", async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await searchAddress(q);
  return NextResponse.json({ results });
});
