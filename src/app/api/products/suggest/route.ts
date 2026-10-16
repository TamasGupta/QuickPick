import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { toPrefixTsQuery } from "@/lib/utils";
import { withApiLogging } from "@/lib/apiLogger";

export interface SuggestionProduct {
  id: string;
  seller_id: string;
  name: string;
  price: number;
  mrp: number | null;
  unit: string | null;
  stock: number;
  image_url: string | null;
  brand: string | null;
  category_id: string | null;
  category_name?: string | null;
  category_slug?: string | null;
}

export interface SuggestionCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface SuggestionResponse {
  query: string;
  products: SuggestionProduct[];
  categories: SuggestionCategory[];
  totalMatches: number;
}

interface ProductQueryRow {
  id: string;
  seller_id: string;
  name: string;
  price: number;
  mrp: number | null;
  unit: string | null;
  stock: number;
  image_url: string | null;
  brand: string | null;
  category_id: string | null;
  categories?: { name: string; slug: string } | null;
}

// GET /api/products/suggest?q=<search> — fast suggestions endpoint for the header search bar.
// Returns top product matches (with categories relation) and matching categories.
export const GET = withApiLogging("/api/products/suggest", async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const rawQ = searchParams.get("q") ?? "";
  const q = rawQ.trim();

  if (!q) {
    return NextResponse.json({
      query: "",
      products: [],
      categories: [],
      totalMatches: 0,
    });
  }

  const supabase = createServerSupabase();

  try {
    const tsQuery = toPrefixTsQuery(q);

    // 1. Primary product search using Postgres full-text search index
    let productQuery = supabase
      .from("products")
      .select("id, seller_id, name, price, mrp, unit, stock, image_url, brand, category_id, categories(name, slug)")
      .eq("is_active", true)
      .limit(6);

    if (tsQuery) {
      productQuery = productQuery.textSearch("search_tsv", tsQuery, { config: "simple" });
    } else {
      productQuery = productQuery.ilike("name", `%${q}%`);
    }

    const [productsRes, categoriesRes] = await Promise.all([
      productQuery,
      supabase
        .from("categories")
        .select("id, name, slug, icon, products!inner(id)")
        .eq("products.is_active", true)
        .ilike("name", `%${q}%`)
        .limit(3),
    ]);

    const rawProducts = (productsRes.data as unknown as ProductQueryRow[] | null) ?? [];
    const rawCategories = (categoriesRes.data as unknown as (SuggestionCategory & { products?: unknown })[] | null) ?? [];
    const categories: SuggestionCategory[] = rawCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
    }));

    const products: SuggestionProduct[] = rawProducts.map((p) => ({
      id: p.id,
      seller_id: p.seller_id,
      name: p.name,
      price: p.price,
      mrp: p.mrp,
      unit: p.unit,
      stock: p.stock,
      image_url: p.image_url,
      brand: p.brand,
      category_id: p.category_id,
      category_name: p.categories?.name ?? null,
      category_slug: p.categories?.slug ?? null,
    }));

    // If prefix tsquery found fewer than 3 items, fallback to substring matching (ilike)
    // so partial keywords or tokens with punctuation are still discovered.
    if (products.length < 3) {
      const existingIds = new Set(products.map((p) => p.id));
      const { data: fallbackData } = await supabase
        .from("products")
        .select("id, seller_id, name, price, mrp, unit, stock, image_url, brand, category_id, categories(name, slug)")
        .eq("is_active", true)
        .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
        .limit(6);

      if (fallbackData) {
        for (const fb of fallbackData as unknown as ProductQueryRow[]) {
          if (!existingIds.has(fb.id)) {
            existingIds.add(fb.id);
            products.push({
              id: fb.id,
              seller_id: fb.seller_id,
              name: fb.name,
              price: fb.price,
              mrp: fb.mrp,
              unit: fb.unit,
              stock: fb.stock,
              image_url: fb.image_url,
              brand: fb.brand,
              category_id: fb.category_id,
              category_name: fb.categories?.name ?? null,
              category_slug: fb.categories?.slug ?? null,
            });
            if (products.length >= 6) break;
          }
        }
      }
    }

    return NextResponse.json(
      {
        query: q,
        products,
        categories,
        totalMatches: products.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch suggestions";
    return NextResponse.json({ error: message, products: [], categories: [], totalMatches: 0 }, { status: 500 });
  }
});
