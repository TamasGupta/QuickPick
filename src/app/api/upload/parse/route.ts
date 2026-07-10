import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { detectType, parseProductFile } from "@/lib/parsers";

export const maxDuration = 60;

// POST /api/upload/parse — accepts a multipart file, returns normalized rows
// for the seller to preview/edit before import. Does NOT write products.
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const type = detectType(file.name, file.type);
  if (!type) {
    return NextResponse.json(
      { error: "Unsupported file. Upload a CSV, Excel (.xlsx), or PDF." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const rows = await parseProductFile(buffer, type);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No product rows could be read from this file." },
        { status: 422 }
      );
    }
    const validCount = rows.filter((r) => r._errors.length === 0).length;
    return NextResponse.json({
      type,
      fileName: file.name,
      totalRows: rows.length,
      validCount,
      rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse file: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
