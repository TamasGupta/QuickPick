import type { SupabaseClient, User } from "@supabase/supabase-js";

// Confirms the caller's profile role is 'rider' before any rider route hands
// out buyer PII (name/phone/address) or lets them claim/advance a delivery.
// Without this, any authenticated buyer could call the rider API routes
// directly and see other buyers' details or hijack a delivery.
export async function requireRider(
  supabase: SupabaseClient,
  user: User
): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return data?.role === "rider";
}

export interface RiderOrder {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  delivery_slot: string | null;
  created_at: string;
  rider_id: string | null;
  store_name: string;
  buyer_name: string;
  buyer_phone: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string | null;
    pincode: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  items: { name: string; qty: number }[];
}

// Attach buyer / address / store / items to a set of orders using the service
// client (server-only). Keeps RLS tight while giving riders exactly what they
// need to complete a delivery.
export async function enrichOrders(
  service: SupabaseClient,
  orders: Record<string, unknown>[]
): Promise<RiderOrder[]> {
  if (orders.length === 0) return [];
  const orderIds = orders.map((o) => o.id as string);
  const buyerIds = [...new Set(orders.map((o) => o.buyer_id as string))];
  const addressIds = [...new Set(orders.map((o) => o.address_id).filter(Boolean) as string[])];
  const sellerIds = [...new Set(orders.map((o) => o.seller_id as string))];

  const [{ data: buyers }, { data: addresses }, { data: items }, { data: sellers }] =
    await Promise.all([
      service.from("profiles").select("id, full_name, phone").in("id", buyerIds),
      addressIds.length
        ? service.from("addresses").select("*").in("id", addressIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      service.from("order_items").select("order_id, name, qty").in("order_id", orderIds),
      service.from("sellers").select("id, store_name").in("id", sellerIds),
    ]);

  const buyerMap = new Map((buyers ?? []).map((b) => [b.id, b]));
  const addrMap = new Map((addresses ?? []).map((a: Record<string, unknown>) => [a.id, a]));
  const sellerMap = new Map((sellers ?? []).map((s) => [s.id, s]));
  const itemsByOrder = new Map<string, { name: string; qty: number }[]>();
  for (const it of items ?? []) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({ name: it.name, qty: it.qty });
    itemsByOrder.set(it.order_id, arr);
  }

  return orders.map((o) => {
    const buyer = buyerMap.get(o.buyer_id as string);
    const a = o.address_id ? (addrMap.get(o.address_id as string) as Record<string, unknown>) : null;
    return {
      id: o.id as string,
      status: o.status as string,
      payment_status: o.payment_status as string,
      total: o.total as number,
      subtotal: o.subtotal as number,
      delivery_fee: o.delivery_fee as number,
      delivery_slot: (o.delivery_slot as string) ?? null,
      created_at: o.created_at as string,
      rider_id: (o.rider_id as string) ?? null,
      store_name: sellerMap.get(o.seller_id as string)?.store_name ?? "Store",
      buyer_name: buyer?.full_name ?? "Customer",
      buyer_phone: buyer?.phone ?? null,
      address: a
        ? {
            line1: a.line1 as string,
            line2: (a.line2 as string) ?? null,
            city: (a.city as string) ?? null,
            pincode: (a.pincode as string) ?? null,
            lat: (a.lat as number) ?? null,
            lng: (a.lng as number) ?? null,
          }
        : null,
      items: itemsByOrder.get(o.id as string) ?? [],
    };
  });
}
