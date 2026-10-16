import { createServiceSupabase } from "@/lib/supabase/server";
import { DELIVERY_FEE, OTHER_CHARGES, MAX_CART_ITEMS, MIN_ORDER } from "@/lib/utils";
import type { AppSettings, ProductRestriction } from "@/lib/types";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: "default",
  delivery_fee: DELIVERY_FEE,
  other_charges: OTHER_CHARGES,
  min_order_amount: MIN_ORDER,
  max_cart_items: MAX_CART_ITEMS,
  max_qty_per_product: 10,
};

// In-memory cache with TTL
let cachedSettings: AppSettings | null = null;
let settingsCacheExpiry = 0;

let cachedRestrictions: Map<string, number> | null = null;
let restrictionsCacheExpiry = 0;

const CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidateSettingsCache(): void {
  cachedSettings = null;
  settingsCacheExpiry = 0;
  cachedRestrictions = null;
  restrictionsCacheExpiry = 0;
}

export async function getAppSettings(client?: ReturnType<typeof createServiceSupabase>): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings && now < settingsCacheExpiry) {
    return cachedSettings;
  }

  try {
    const supabase = client ?? createServiceSupabase();
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", "default")
      .single();

    if (error || !data) {
      // Table might not exist yet or no row found — fall back safely
      return DEFAULT_APP_SETTINGS;
    }

    const settings: AppSettings = {
      id: data.id ?? "default",
      delivery_fee: Number(data.delivery_fee ?? DEFAULT_APP_SETTINGS.delivery_fee),
      other_charges: Number(data.other_charges ?? DEFAULT_APP_SETTINGS.other_charges),
      min_order_amount: Number(data.min_order_amount ?? DEFAULT_APP_SETTINGS.min_order_amount),
      max_cart_items: Number(data.max_cart_items ?? DEFAULT_APP_SETTINGS.max_cart_items),
      max_qty_per_product: Number(data.max_qty_per_product ?? DEFAULT_APP_SETTINGS.max_qty_per_product),
      updated_at: data.updated_at,
    };

    cachedSettings = settings;
    settingsCacheExpiry = now + CACHE_TTL_MS;
    return settings;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export async function getProductRestrictionsMap(
  client?: ReturnType<typeof createServiceSupabase>
): Promise<Map<string, number>> {
  const now = Date.now();
  if (cachedRestrictions && now < restrictionsCacheExpiry) {
    return cachedRestrictions;
  }

  const map = new Map<string, number>();
  try {
    const supabase = client ?? createServiceSupabase();
    const { data, error } = await supabase
      .from("product_restrictions")
      .select("product_id, max_qty");

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row.product_id && row.max_qty > 0) {
          map.set(row.product_id, Number(row.max_qty));
        }
      }
    }

    cachedRestrictions = map;
    restrictionsCacheExpiry = now + CACHE_TTL_MS;
    return map;
  } catch {
    return map;
  }
}

export async function getProductRestrictionsList(
  client?: ReturnType<typeof createServiceSupabase>
): Promise<ProductRestriction[]> {
  try {
    const supabase = client ?? createServiceSupabase();
    const { data, error } = await supabase
      .from("product_restrictions")
      .select(`
        product_id,
        max_qty,
        created_at,
        updated_at,
        products (
          id,
          name,
          price,
          stock,
          image_url,
          unit,
          brand,
          sellers (
            store_name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as unknown as ProductRestriction[];
  } catch {
    return [];
  }
}
