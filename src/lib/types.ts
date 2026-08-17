// Shared domain types for GrabOn.

export type UserRole = "buyer" | "seller" | "admin" | "rider";
export type SellerStatus = "pending" | "approved" | "suspended";
export type OrderStatus =
  | "placed"
  | "accepted"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  // Seller flagged one or more items out of stock — paused, waiting on the
  // buyer to continue (dropping those items) or cancel. See migration 013.
  | "action_required";
export type PaymentStatus = "pending" | "paid" | "failed" | "cod";

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  mrp: number | null;
  unit: string | null;
  stock: number;
  sku: string | null;
  image_url: string | null;
  image_source: "seller" | "auto" | null;
  brand: string | null;
  is_active: boolean;
}

export interface Seller {
  id: string;
  owner_id: string;
  store_name: string;
  status: SellerStatus;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string; // IANA tz string, e.g. "Asia/Kolkata"
}

// One row per (seller, day-of-week) in the store_hours table.
// day_of_week: 0 = Sunday … 6 = Saturday (matches JS Date.getDay() and
// Postgres EXTRACT(dow)). Mirrors supabase/migrations/20260101000013_store_hours.sql.
export interface StoreHour {
  id: string;
  seller_id: string;
  day_of_week: number;  // 0–6
  is_closed: boolean;
  opens_at: string | null;   // "HH:MM:SS" or null
  closes_at: string | null;  // "HH:MM:SS" or null
}

// Shape returned by GET /api/sellers/:id/hours
export interface StoreHoursStatus {
  is_open: boolean;
  timezone: string;
  schedule: StoreHour[]; // up to 7 rows, ordered by day_of_week
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  rider_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_fee: number;
  other_charges: number;
  total: number;
  delivery_slot: string | null;
  delivery_otp: string | null;
  delivery_payment_method: "cash" | "online" | null;
  cancel_reason: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  qty: number;
  out_of_stock: boolean;
  oos_reason: string | null;
}

// Canonical shape a parsed upload row is normalized into.
export interface ParsedProductRow {
  name: string;
  description?: string;
  category?: string;
  price: number | null;
  mrp?: number | null;
  unit?: string;
  stock: number | null;
  sku?: string;
  image_url?: string;
  brand?: string;
  // Validation feedback per row (empty = valid)
  _errors: string[];
  _rowIndex: number;
}

export type LedgerParty = "admin" | "seller" | "rider";

// One row = money that needs to move from `from_party` to `to_party` for a
// single delivered order. See supabase/migrations/20260101000011_payout_ledger.sql
// for the full reasoning on when/why these get created.
export interface LedgerEntry {
  id: string;
  order_id: string;
  seller_id: string;
  rider_id: string | null;
  from_party: LedgerParty;
  to_party: LedgerParty;
  amount: number;
  label: string;
  settled: boolean;
  settled_at: string | null;
  created_at: string;
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "placed",
  "accepted",
  "packed",
  "out_for_delivery",
  "delivered",
];
