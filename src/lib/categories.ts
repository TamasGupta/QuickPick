// Local category images live in /public/categories/<slug>.jpg.
// Downloaded so we don't depend on external URLs that can break.
const CATEGORY_IMAGES = new Set([
  "fruits-vegetables",
  "dairy-bread",
  "snacks",
  "beverages",
  "staples",
  "personal-care",
  "household",
  "instant-food",
]);

export function categoryImage(slug: string): string | null {
  return CATEGORY_IMAGES.has(slug) ? `/categories/${slug}.jpg` : null;
}
