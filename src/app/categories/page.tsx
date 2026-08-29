import Link from "next/link";
import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { categoryImage } from "@/lib/categories";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop by Category",
  description:
    "Browse all grocery categories — fruits, vegetables, dairy, snacks and more. Fast delivery guaranteed.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("categories").select("*").order("name");
  const categories = (data as Category[]) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">All categories</h1>
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((c) => {
          const img = categoryImage(c.slug);
          return (
            <Link
              key={c.id}
              href={`/?cat=${c.slug}`}
              className="group card overflow-hidden transition hover:-translate-y-1 hover:shadow-pop"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-50 to-accent-50">
                {img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={img}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-4xl">
                    {c.icon}
                  </span>
                )}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="absolute bottom-2 left-3 text-sm font-bold text-white drop-shadow">
                  {c.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
