import Link from "next/link";
import { Zap, BadgePercent, Leaf, ArrowRight, type LucideIcon } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { ProductGrid } from "@/components/ProductGrid";
import { HeroCarousel } from "@/components/HeroCarousel";
import { categoryImage } from "@/lib/categories";
import { PRODUCTS_PAGE_SIZE, encodeProductCursor } from "@/lib/utils";
import type { Category, Product } from "@/lib/types";

// Filenames under /public/banners — add/remove files there and update this
// list to change what the homepage hero carousel shows.
const HERO_BANNERS = [
  "/banners/banner-1.jpg",
  "/banners/banner-2.jpg",
  "/banners/banner-3.jpg",
  "/banners/banner-4.jpg",
  "/banners/banner-5.jpg",
];

type ProductRow = Product & { created_at: string };

interface ValueProp {
  icon: LucideIcon;
  title: string;
  sub: string;
}

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string };
}) {
  const supabase = createServerSupabase();

  const { data: categories } = await supabase.from("categories").select("*").order("name");

  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    // id breaks ties — a whole bulk-import batch can share one created_at
    // timestamp, so ordering by created_at alone isn't a stable pagination
    // key (see encodeProductCursor in lib/utils.ts).
    .order("id", { ascending: false })
    // Fetch one extra row to know whether there's a next page.
    .limit(PRODUCTS_PAGE_SIZE + 1);

  const activeCat = (categories as Category[] | null)?.find((c) => c.slug === searchParams.cat);
  if (activeCat) query = query.eq("category_id", activeCat.id);
  if (searchParams.q) {
    query = query.textSearch("search_tsv", searchParams.q, { type: "websearch", config: "simple" });
  }

  const { data: products } = await query;
  const rows = (products as ProductRow[] | null) ?? [];
  const hasMore = rows.length > PRODUCTS_PAGE_SIZE;
  const list = hasMore ? rows.slice(0, PRODUCTS_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? encodeProductCursor(list[list.length - 1]) : null;
  const searching = Boolean(searchParams.q || searchParams.cat);

  return (
    <div className="space-y-6">
      {!searching && (
        <>
          {/* Hero — banners auto-scroll as the background; text/CTA overlay on top */}
          <section className="relative isolate h-64 overflow-hidden rounded-3xl shadow-pop animate-fade-in sm:h-72 md:h-80">
            <HeroCarousel images={HERO_BANNERS} />
            {/* Scrim so white text stays readable over any banner's colors */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
            <div className="relative flex h-full flex-col justify-center p-6 text-white sm:p-8">
              <span className="badge w-fit bg-white/20 text-white backdrop-blur">
                <Zap className="h-3 w-3 fill-white animate-pulse" /> Delivery in 11 minutes
              </span>
              <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                Groceries &amp; essentials,<br className="hidden sm:block" /> delivered in minutes
              </h1>
              <p className="mt-1.5 max-w-md text-sm text-white/85">
                Fresh produce, daily needs and more — at your door before you finish your coffee.
              </p>
              <Link
                href="#products"
                className="btn group mt-4 w-fit bg-white font-bold text-brand-700 hover:bg-white/90"
              >
                Start shopping
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>

          {/* Value props */}
          <section className="grid grid-cols-3 gap-2.5">
            {(
              [
                { icon: Zap, title: "11-min", sub: "Delivery" },
                { icon: BadgePercent, title: "Best prices", sub: "Everyday" },
                { icon: Leaf, title: "Farm fresh", sub: "Handpicked" },
              ] satisfies ValueProp[]
            ).map((v) => (
              <div
                key={v.title}
                className="card group flex flex-col items-center gap-1.5 p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-pop sm:flex-row sm:gap-3 sm:text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand-100">
                  <v.icon className="h-5 w-5 transition-transform group-hover:animate-wiggle" />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-bold text-ink sm:text-sm">{v.title}</p>
                  <p className="truncate text-[11px] text-ink-faint">{v.sub}</p>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {/* Categories */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">Shop by category</h2>
        </div>
        <div className="stagger grid grid-cols-4 gap-2.5 sm:grid-cols-8">
          {(categories as Category[] | null)?.map((c) => {
            const active = activeCat?.id === c.id;
            const img = categoryImage(c.slug);
            return (
              <Link
                key={c.id}
                href={active ? "/" : `/?cat=${c.slug}`}
                className="group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center transition hover:-translate-y-1"
              >
                <span
                  className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 shadow-card transition-shadow group-hover:shadow-pop ${
                    active ? "ring-2 ring-brand-500 ring-offset-2" : ""
                  }`}
                >
                  {img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <span className="text-2xl">{c.icon}</span>
                  )}
                </span>
                <span className="text-[11px] font-semibold leading-tight text-ink-soft">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Products */}
      <section id="products">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">
            {searchParams.q ? `Results for "${searchParams.q}"` : activeCat ? activeCat.name : "Popular right now"}
          </h2>
          {searching && (
            <Link href="/" className="text-sm font-semibold text-brand-700">
              Clear
            </Link>
          )}
        </div>

        {list.length === 0 ? (
          <div className="card p-10 text-center text-ink-soft">
            <p className="text-5xl">🧺</p>
            <p className="mt-3 font-semibold text-ink">No products found.</p>
            <p className="mt-1 text-sm">Try a different search or check back soon.</p>
          </div>
        ) : (
          <ProductGrid
            key={`${searchParams.q ?? ""}-${searchParams.cat ?? ""}`}
            initialProducts={list}
            initialNextCursor={nextCursor}
            q={searchParams.q}
            catSlug={searchParams.cat}
          />
        )}
      </section>
    </div>
  );
}
