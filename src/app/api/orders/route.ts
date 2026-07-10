import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { DELIVERY_FEE } from "@/lib/utils";

interface IncomingItem {
  product_id: string;
  name: string;
  price: number;
  qty: number;
}

// POST /api/orders — create an order for the logged-in buyer.
// Prices are re-fetched server-side (never trust client prices).
export async function POST(req: Request) {
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

  const service = createServiceSupabase();

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

  const total = subtotal + DELIVERY_FEE;

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
}
