import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { DELIVERY_FEE, OTHER_CHARGES, MAX_CART_ITEMS } from "@/lib/utils";
import { withApiLogging } from "@/lib/apiLogger";
import { haversineKm, MAX_DELIVERY_RADIUS_KM } from "@/lib/geo";

interface IncomingItem {
  product_id: string;
  name: string;
  price: number;
  qty: number;
}

// POST /api/orders — create an order for the logged-in buyer.
// Prices are re-fetched server-side (never trust client prices).
export const POST = withApiLogging("/api/orders", async (req: Request) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { seller_id, address_id, delivery_slot, payment_method, items } = body as {
    seller_id: string;
    address_id: string;
    delivery_slot: string;
    payment_method: "online" | "cod";
    items: IncomingItem[];
  };

  if (!seller_id || !items?.length) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
  }
  if (items.length > MAX_CART_ITEMS) {
    return NextResponse.json({ error: `Orders are limited to ${MAX_CART_ITEMS} products at a time.` }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Enforce the delivery radius. Never trust a client-computed distance —
  // re-fetch both points and recompute server-side. If either the seller or
  // the buyer's address has no pinned location, we can't verify distance, so
  // the order is allowed through rather than blocking on missing data.
  const [{ data: seller }, { data: address }] = await Promise.all([
    service.from("sellers").select("lat, lng, timezone").eq("id", seller_id).single(),
    service.from("addresses").select("lat, lng").eq("id", address_id).eq("user_id", user.id).single(),
  ]);
  if (seller?.lat != null && seller?.lng != null && address?.lat != null && address?.lng != null) {
    const distanceKm = haversineKm(
      { lat: seller.lat, lng: seller.lng },
      { lat: address.lat, lng: address.lng }
    );
    if (distanceKm > MAX_DELIVERY_RADIUS_KM) {
      return NextResponse.json(
        {
          error: `This store is ${distanceKm.toFixed(1)} km away — we currently only deliver within ${MAX_DELIVERY_RADIUS_KM} km.`,
        },
        { status: 400 }
      );
    }
  }

  // Store-hours gate — authoritative check runs in Postgres so tz math is
  // correct regardless of the server runtime's local timezone (Vercel = UTC).
  // A store with no hours configured is treated as always open (RPC returns true).
  const { data: storeOpen } = await service.rpc("is_store_open", { p_seller_id: seller_id });
  if (storeOpen === false) {
    return NextResponse.json(
      { error: "This store is currently closed. Please check their opening hours and try again." },
      { status: 400 }
    );
  }

  // Re-price against the DB to prevent tampering.
  const ids = items.map((i) => i.product_id);
  const { data: products, error: pErr } = await service
    .from("products")
    .select("id, price, name, stock, seller_id, is_active")
    .in("id", ids);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const priceMap = new Map(products?.map((p) => [p.id, p]));
  let subtotal = 0;
  const validated = [];
  for (const it of items) {
    const p = priceMap.get(it.product_id);
    if (!p || !p.is_active) {
      return NextResponse.json({ error: `Product unavailable: ${it.name}` }, { status: 400 });
    }
    if (p.seller_id !== seller_id) {
      return NextResponse.json({ error: "All items must be from one seller" }, { status: 400 });
    }
    if (p.stock < it.qty) {
      return NextResponse.json({ error: `Out of stock: ${p.name}` }, { status: 409 });
    }
    subtotal += Number(p.price) * it.qty;
    validated.push({ product_id: p.id, name: p.name, price: Number(p.price), qty: it.qty });
  }

  const total = subtotal + DELIVERY_FEE + OTHER_CHARGES;

  // 4-digit delivery OTP the buyer shares with the rider at handover.
  const delivery_otp = String(Math.floor(1000 + Math.random() * 9000));

  // Create order (as the buyer, so RLS + buyer_id are enforced).
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id,
      address_id,
      delivery_slot,
      subtotal,
      delivery_fee: DELIVERY_FEE,
      other_charges: OTHER_CHARGES,
      total,
      status: "placed",
      payment_status: payment_method === "cod" ? "cod" : "pending",
      delivery_otp,
    })
    .select()
    .single();
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  // Insert items with the service client (bypass RLS for the join write).
  const { error: iErr } = await service.from("order_items").insert(
    validated.map((v) => ({ order_id: order.id, ...v }))
  );
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  // COD: reserve stock immediately.
  if (payment_method === "cod") {
    await service.rpc("decrement_stock", { p_order_id: order.id });
  }

  return NextResponse.json({ id: order.id, total });
});
