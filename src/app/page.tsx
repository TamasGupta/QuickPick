import Link from "next/link";
import { Zap, BadgePercent, Leaf, ArrowRight, type LucideIcon } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";
import { LottieIcon, type LottieName } from "@/components/LottieIcon";
import { categoryImage } from "@/lib/categories";
import type { Category, Product } from "@/lib/types";

interface ValueProp {
  icon?: LucideIcon;
  lottie?: LottieName;
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
    .limit(60);

  const activeCat = (categories as Category[] | null)?.find((c) => c.slug === searchParams.cat);
  if (activeCat) query = query.eq("category_id", activeCat.id);
  if (searchParams.q) {
    query = query.textSearch("search_tsv", searchParams.q, { type: "websearch", config: "simple" });
  }

  const { data: products } = await query;
  const list = (products as Product[] | null) ?? [];
  const searching = Boolean(searchParams.q || searchParams.cat);

  return (
    <div className="space-y-6">
      {!searching && (
        <>
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 p-6 text-white shadow-pop animate-fade-in sm:p-8">
            <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 animate-float" />
            <div
              className="absolute -bottom-12 right-16 h-32 w-32 rounded-full bg-white/10 animate-float"
              style={{ animationDelay: "1s" }}
            />
            <div className="relative">
              <span className="badge bg-white/20 text-white backdrop-blur">
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
                className="btn group mt-4 bg-white font-bold text-brand-700 hover:bg-white/90"
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
                { lottie: "vehicle", title: "11-min", sub: "Delivery" },
                { icon: BadgePercent, title: "Best prices", sub: "Everyday" },
                { icon: Leaf, title: "Farm fresh", sub: "Handpicked" },
              ] satisfies ValueProp[]
            ).map((v) => (
              <div
                key={v.title}
                className="card group flex flex-col items-center gap-1.5 p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-pop sm:flex-row sm:gap-3 sm:text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand-100">
                  {v.lottie ? (
                    <LottieIcon name={v.lottie} className="h-7 w-7" />
                  ) : v.icon ? (
                    <v.icon className="h-5 w-5 transition-transform group-hover:animate-wiggle" />
                  ) : null}
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
            <p className="mt-1 text-sm">
              Are you a seller?{" "}
              <Link href="/seller" className="font-semibold text-brand-700 underline">
                Upload your catalog
              </Link>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
