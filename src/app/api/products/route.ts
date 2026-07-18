import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PRODUCTS_PAGE_SIZE, encodeProductCursor, decodeProductCursor } from "@/lib/utils";
import { withApiLogging } from "@/lib/apiLogger";
import type { Category, Product } from "@/lib/types";

type ProductRow = Product & { created_at: string };

// GET /api/products?cat=<slug>&q=<search>&cursor=<opaque> — one page of the
// home/search/category grid, for infinite scroll. Cursor-based (not OFFSET)
// so results stay stable even as new products are added while a buyer is
// scrolling, ordered by (created_at, id) — id breaks ties, since a whole
// bulk-import batch can share one created_at timestamp (see lib/utils.ts).
export const GET = withApiLogging("/api/products", async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const catSlug = searchParams.get("cat");
  const q = searchParams.get("q");
  const cursorParam = searchParams.get("cursor");

  const supabase = createServerSupabase();

  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    // Fetch one extra row to know whether there's a next page.
    .limit(PRODUCTS_PAGE_SIZE + 1);

  if (catSlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", catSlug)
      .single();
    if (cat) query = query.eq("category_id", (cat as Category).id);
  }
  if (q) {
    query = query.textSearch("search_tsv", q, { type: "websearch", config: "simple" });
  }
  if (cursorParam) {
    const cursor = decodeProductCursor(cursorParam);
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as ProductRow[] | null) ?? [];
  const hasMore = rows.length > PRODUCTS_PAGE_SIZE;
  const products = hasMore ? rows.slice(0, PRODUCTS_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? encodeProductCursor(products[products.length - 1]) : null;

  return NextResponse.json({ products, nextCursor });
});
