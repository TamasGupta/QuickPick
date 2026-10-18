import { NextResponse } from "next/server";
import { getAppSettings, getProductRestrictionsMap } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
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
