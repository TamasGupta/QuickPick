import { NextResponse } from "next/server";
import { getAppSettings, getProductRestrictionsMap } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, restrictionsMap] = await Promise.all([
      getAppSettings(),
      getProductRestrictionsMap(),
    ]);

    const restrictions: Record<string, number> = {};
    for (const [id, limit] of restrictionsMap.entries()) {
      restrictions[id] = limit;
    }

    return NextResponse.json(
      { settings, restrictions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
