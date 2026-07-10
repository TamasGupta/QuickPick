import type { ParsedProductRow } from "@/lib/types";

// Map many possible header spellings to our canonical field names.
const HEADER_ALIASES: Record<string, keyof ParsedProductRow> = {
  name: "name",
  "product name": "name",
  product: "name",
  title: "name",
  item: "name",

  description: "description",
  desc: "description",
  details: "description",

  category: "category",
  cat: "category",
  "category name": "category",

  price: "price",
  "selling price": "price",
  "sale price": "price",
  rate: "price",
  amount: "price",

  mrp: "mrp",
  "max retail price": "mrp",
  "list price": "mrp",

  unit: "unit",
  uom: "unit",
  quantity_unit: "unit",
  pack: "unit",

  stock: "stock",
  qty: "stock",
  quantity: "stock",
  inventory: "stock",
  "stock qty": "stock",

  sku: "sku",
  "sku code": "sku",
  code: "sku",
  barcode: "sku",

  image: "image_url",
  image_url: "image_url",
  "image url": "image_url",
  img: "image_url",
  photo: "image_url",

  brand: "brand",
  manufacturer: "brand",
  make: "brand",
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  // Strip currency symbols, commas, spaces.
  const cleaned = String(v).replace(/[₹$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeHeader(h: string): keyof ParsedProductRow | null {
  const key = h.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? null;
}

/**
 * Convert an array of raw row objects (keyed by original headers) into
 * canonical, validated ParsedProductRow objects.
 */
export function normalizeRows(
  rawRows: Record<string, unknown>[]
): ParsedProductRow[] {
  return rawRows.map((raw, i) => {
    const mapped: Partial<ParsedProductRow> = {};
    for (const [header, value] of Object.entries(raw)) {
      const field = normalizeHeader(header);
      if (!field) continue;
      (mapped as Record<string, unknown>)[field] =
        typeof value === "string" ? value.trim() : value;
    }

    const row: ParsedProductRow = {
      name: (mapped.name as string) || "",
      description: mapped.description as string | undefined,
      category: mapped.category as string | undefined,
      price: toNumber(mapped.price),
      mrp: toNumber(mapped.mrp),
      unit: (mapped.unit as string) || "unit",
      stock: toNumber(mapped.stock),
      sku: mapped.sku as string | undefined,
      image_url: mapped.image_url as string | undefined,
      brand: mapped.brand as string | undefined,
      _errors: [],
      _rowIndex: i + 1,
    };

    // Validation
    if (!row.name) row._errors.push("Missing product name");
    if (row.price === null) row._errors.push("Missing/invalid price");
    else if (row.price < 0) row._errors.push("Price cannot be negative");
    if (row.stock === null) row.stock = 0; // default, not an error
    if (row.mrp != null && row.price !== null && row.mrp < row.price)
      row._errors.push("MRP is less than price");

    return row;
  });
}

// Rough heuristic parser for free-text PDF lines when there is no clean table.
// Tries to pull "Name  ...  ₹price" style lines. Everything is surfaced in the
// preview/edit step, so imperfect parsing is acceptable and never silent.
export function parsePdfLines(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: Record<string, unknown>[] = [];
  // Matches a trailing price like "₹120", "120.00", "Rs 120"
  const priceRe = /(?:₹|rs\.?\s?)?(\d+(?:\.\d{1,2})?)\s*$/i;

  for (const line of lines) {
    // Skip obvious headers/footers.
    if (/^(name|product|item|s\.?no|page\b)/i.test(line)) continue;
    const m = line.match(priceRe);
    if (!m) continue;
    const price = m[1];
    const name = line.slice(0, m.index).replace(/[-–:|]+$/, "").trim();
    if (!name) continue;
    rows.push({ name, price });
  }
  return rows;
}
