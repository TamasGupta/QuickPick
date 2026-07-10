// Shared domain types for QuickPick.

export type UserRole = "buyer" | "seller" | "admin" | "rider";
export type SellerStatus = "pending" | "approved" | "suspended";
export type OrderStatus =
  | "placed"
  | "accepted"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
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
  brand: string | null;
  is_active: boolean;
}

export interface Seller {
  id: string;
  owner_id: string;
  store_name: string;
  status: SellerStatus;
  city: string | null;
  pincode: string | null;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string | null;
  pincode: string;
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
  total: number;
  delivery_slot: string | null;
  delivery_otp: string | null;
  created_at: string;
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

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "placed",
  "accepted",
  "packed",
  "out_for_delivery",
  "delivered",
];
