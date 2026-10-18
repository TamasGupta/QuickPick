import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";
import { haversineKm, MAX_DELIVERY_RADIUS_KM } from "@/lib/geo";
import { sendPushToUser } from "@/lib/push";
import { getAppSettings, getProductRestrictionsMap } from "@/lib/settings";

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
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Fallback to Bearer token from Authorization header if cookie is absent
  // (e.g. API clients, mobile apps, or k6 load testing scenarios)
  if (!user) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const service = createServiceSupabase();
      const { data } = await service.auth.getUser(token);
      user = data.user;
    }
  }

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

  const service = createServiceSupabase();
  const [settings, restrictionsMap] = await Promise.all([
    getAppSettings(service),
    getProductRestrictionsMap(service),
  ]);

  if (items.length > settings.max_cart_items) {
    return NextResponse.json(
      { error: `Orders are limited to ${settings.max_cart_items} products at a time.` },
      { status: 400 }
    );
  }

  // Enforce the delivery radius. Never trust a client-computed distance —
  // re-fetch both points and recompute server-side.
  const [{ data: seller }, { data: address }] = await Promise.all([
    service.from("sellers").select("lat, lng, timezone, owner_id, store_name").eq("id", seller_id).single(),
    service.from("addresses").select("lat, lng").eq("id", address_id).eq("user_id", user.id).single(),
  ]);
  if (seller?.lat != null && seller?.lng != null) {
    // The seller's own location is known, so distance CAN be verified — a
    // buyer address with no pin (typed manually, map never opened) used to
    // silently skip this whole check and let the order through with the
    // delivery radius never actually enforced. Require a pin instead of
    // treating "we don't know" as "assume it's fine" — same bug existed
    // client-side in checkout/page.tsx's outOfRange check (distanceKm stays
    // null for an unpinned address), fixed there too.
    if (address?.lat == null || address?.lng == null) {
      return NextResponse.json(
        { error: "Please pin your exact delivery location before placing this order." },
        { status: 400 }
      );
    }
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
  // If the seller itself has no pinned location, there's nothing to verify
  // distance against regardless of the buyer's address — that's a
  // seller/admin setup gap, not something to block a buyer's order over.

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

  // Re-price against the DB to prevent tampering and enforce purchase restrictions.
  const ids = items.map((i) => i.product_id);
  let products: any[] | null = null;
  const { data: prodsWithLimit, error: pErrWithLimit } = await service
    .from("products")
    .select("id, price, name, stock, seller_id, is_active, max_order_qty")
    .in("id", ids);

  if (!pErrWithLimit && prodsWithLimit) {
    products = prodsWithLimit;
  } else {
    const { data: prodsBasic, error: pErrBasic } = await service
      .from("products")
      .select("id, price, name, stock, seller_id, is_active")
      .in("id", ids);
    if (pErrBasic) return NextResponse.json({ error: pErrBasic.message }, { status: 500 });
    products = prodsBasic;
  }

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

    // Check purchase restrictions for this specific product or default product limit
    const customLimit = restrictionsMap.get(it.product_id) ?? (p as any).max_order_qty;
    const itemMaxAllowed = customLimit && customLimit > 0 ? customLimit : settings.max_qty_per_product;
    if (it.qty > itemMaxAllowed) {
      return NextResponse.json(
        {
          error: `You can only order up to ${itemMaxAllowed} unit${itemMaxAllowed > 1 ? "s" : ""} of ${p.name}. Please adjust your cart quantity.`,
        },
        { status: 400 }
      );
    }

    subtotal += Number(p.price) * it.qty;
    validated.push({ product_id: p.id, name: p.name, price: Number(p.price), qty: it.qty });
  }

  // Validate minimum order amount
  if (subtotal < settings.min_order_amount) {
    return NextResponse.json(
      {
        error: `Order subtotal must be at least ₹${settings.min_order_amount} to place an order.`,
      },
      { status: 400 }
    );
  }

  const delivery_fee = settings.delivery_fee;
  const other_charges = settings.other_charges;
  const total = subtotal + delivery_fee + other_charges;

  // Deduplication check: check if the buyer placed an identical order within the last 90 seconds.
  // Prevents multiple orders from double-clicks, mobile retries, or network reconnects.
  const dedupeWindow = new Date(Date.now() - 90 * 1000).toISOString();
  const { data: recentOrders } = await service
    .from("orders")
    .select("id, total, subtotal, status, created_at")
    .eq("buyer_id", user.id)
    .eq("seller_id", seller_id)
    .eq("payment_status", payment_method === "cod" ? "cod" : "pending")
    .in("status", ["placed", "accepted", "packed"])
    .gte("created_at", dedupeWindow)
    .order("created_at", { ascending: false });

  if (recentOrders && recentOrders.length > 0) {
    const matchingOrder = recentOrders.find((ro) => Math.abs(Number(ro.subtotal) - subtotal) < 0.01);
    if (matchingOrder) {
      const { data: recentItems } = await service
        .from("order_items")
        .select("product_id, qty")
        .eq("order_id", matchingOrder.id);

      if (recentItems && recentItems.length === validated.length) {
        const sortedA = [...recentItems].sort((a, b) => a.product_id.localeCompare(b.product_id));
        const sortedB = [...validated].sort((a, b) => a.product_id.localeCompare(b.product_id));
        const itemsMatch = sortedA.every(
          (item, idx) => item.product_id === sortedB[idx].product_id && Number(item.qty) === Number(sortedB[idx].qty)
        );

        if (itemsMatch) {
          console.warn(`[orders] Duplicate order detected for buyer ${user.id}, returning existing order ${matchingOrder.id}`);
          return NextResponse.json({ id: matchingOrder.id, total: matchingOrder.total, duplicate: true });
        }
      }
    }
  }

  // 4-digit delivery OTP the buyer shares with the rider at handover.
  const delivery_otp = String(Math.floor(1000 + Math.random() * 9000));

  // Create order with verified buyer_id
  const { data: order, error: oErr } = await service
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id,
      address_id,
      delivery_slot,
      subtotal,
      delivery_fee,
      other_charges,
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

  // Online orders aren't real yet at this point (payment_status: "pending"
  // until /api/payment/verify confirms it) — only a COD order is genuinely
  // new/actionable for the seller right now, matching the same
  // payment_status != 'pending' filter SellerNav's badge count already uses.
  if (payment_method === "cod" && seller?.owner_id) {
    void sendPushToUser(seller.owner_id, {
      title: "New order received",
      body: `A new COD order worth ${total} is waiting to be accepted.`,
      url: "/seller/orders",
      tag: `order-${order.id}`,
    });
  }

  return NextResponse.json({ id: order.id, total });
});
