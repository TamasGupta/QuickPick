export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

// Always renders in Indian Standard Time regardless of server/browser
// timezone (Vercel's serverless runtime defaults to UTC, which would
// otherwise show times 5:30 off for Indian users).
export function formatIST(date: string | Date): string {
  return new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const DELIVERY_FEE = Number(process.env.NEXT_PUBLIC_DELIVERY_FEE ?? 25);

// Flat platform/handling fee, separate from the delivery fee — covers
// packaging, payment gateway fees, etc. Shown as its own line in the bill.
export const OTHER_CHARGES = Number(process.env.NEXT_PUBLIC_OTHER_CHARGES ?? 15);

// Quick-commerce v1 rule: cap distinct products per cart/order. Doesn't
// limit the quantity of an item already added, just how many different
// products. Enforced client-side (store/cart.ts, so a buyer can't even add
// a 21st) and re-checked server-side (/api/orders, since the client cart is
// never trusted directly).
export const MAX_CART_ITEMS = 20;

// Products per page for the home/search/category infinite-scroll grid.
export const PRODUCTS_PAGE_SIZE = 24;

// Cursor for paginating products ordered by (created_at desc, id desc).
// created_at alone isn't unique — bulk imports insert many rows in one
// statement, and Postgres evaluates now() once per statement, so an entire
// import batch can share the exact same created_at. A plain `created_at <
// cursor` filter then silently drops every row that ties with the boundary
// row. Encoding `id` (unique) alongside it as a tiebreaker fixes that.
export function encodeProductCursor(row: { created_at: string; id: string }): string {
  return `${row.created_at}|${row.id}`;
}

export function decodeProductCursor(cursor: string): { created_at: string; id: string } | null {
  const i = cursor.lastIndexOf("|");
  if (i === -1) return null;
  return { created_at: cursor.slice(0, i), id: cursor.slice(i + 1) };
}
export const MIN_ORDER = Number(process.env.NEXT_PUBLIC_MIN_ORDER ?? 99);

// Builds a prefix-matching tsquery for product search, e.g. "mil bread" ->
// "mil:*&bread:*". `websearch_to_tsquery` (what `.textSearch(..., {type:
// "websearch"})` uses) only matches whole lexemes, so "mil" would never
// match "milk" — that's the exact bug this fixes, and it matters more now
// that the header search is debounced and fires on every partial keystroke.
// Passing this string with no `type` option makes supabase-js hit
// `to_tsquery` directly, so each term needs its own `:*` prefix operator.
export function toPrefixTsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .map((w) => `${w}:*`)
    .join(" & ");
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: "Order Placed",
  accepted: "Accepted",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
