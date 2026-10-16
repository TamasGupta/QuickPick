import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";
import { getAppSettings } from "@/lib/settings";

const now = () => new Date().toISOString();

interface ExtraItem {
  product_id: string;
  qty: number;
}

// POST /api/orders/:id/resolve-issue — buyer responds to a seller-reported
// stock issue (order status 'action_required'):
//
//   { action: "cancel" }
//     -> order is cancelled outright.
//
//   { action: "continue", extraItems?: [{ product_id, qty }] }
//     -> drops the out-of-stock items and resumes the order. If the
//        remaining total would fall below MIN_ORDER, extraItems (only
//        allowed on COD orders — an online order already collected a fixed
//        amount, so it can't easily charge more) are added first; if it's
//        STILL short after that, responds with `code: "below_minimum"` so
//        the buyer can add more and call this again rather than losing
//        items they already added.
export const POST = withApiLogging(
  "/api/orders/[id]/resolve-issue",
  async (req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      action?: "cancel" | "continue";
      extraItems?: ExtraItem[];
    };

    const service = createServiceSupabase();

    const { data: order } = await service
      .from("orders")
      .select("id, buyer_id, seller_id, status, payment_status, delivery_fee, other_charges")
      .eq("id", params.id)
      .single();
    if (!order || order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "action_required") {
      return NextResponse.json({ error: "This order isn't waiting on a response" }, { status: 409 });
    }

    if (body.action === "cancel") {
      const { error } = await service
        .from("orders")
        .update({ status: "cancelled", updated_at: now() })
        .eq("id", order.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    if (body.action !== "continue") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (body.extraItems?.length) {
      if (order.payment_status !== "cod") {
        return NextResponse.json(
          { error: "Adding items isn't available for prepaid orders — please cancel and place a new order instead." },
          { status: 400 }
        );
      }

      const ids = body.extraItems.map((i) => i.product_id);
      const { data: products } = await service
        .from("products")
        .select("id, name, price, stock, seller_id, is_active")
        .in("id", ids);
      const priceMap = new Map((products ?? []).map((p) => [p.id, p]));

      const toInsert: { order_id: string; product_id: string; name: string; price: number; qty: number }[] = [];
      for (const it of body.extraItems) {
        const p = priceMap.get(it.product_id);
        if (!p || !p.is_active || p.seller_id !== order.seller_id) {
          return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
        }
        if (p.stock < it.qty) {
          return NextResponse.json({ error: `Out of stock: ${p.name}` }, { status: 409 });
        }
        toInsert.push({ order_id: order.id, product_id: p.id, name: p.name, price: p.price, qty: it.qty });
      }

      const { error: insertErr } = await service.from("order_items").insert(toInsert);
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

      // Reserve stock for the newly added items only — decrement_stock(order_id)
      // operates on every item in the order, which would double-decrement the
      // items already reserved when this order was first placed.
      for (const it of toInsert) {
        const p = priceMap.get(it.product_id)!;
        await service
          .from("products")
          .update({ stock: p.stock - it.qty })
          .eq("id", it.product_id);
      }
    }

    const { data: items } = await service
      .from("order_items")
      .select("price, qty, out_of_stock")
      .eq("order_id", order.id);

    const subtotal = (items ?? [])
      .filter((i) => !i.out_of_stock)
      .reduce((s, i) => s + Number(i.price) * i.qty, 0);

    const settings = await getAppSettings(service);
    const minOrder = settings.min_order_amount;

    if (subtotal < minOrder) {
      return NextResponse.json(
        {
          error: `Add ${minOrder - subtotal} more to continue — this order would fall below the ${minOrder} minimum.`,
          code: "below_minimum",
          shortBy: Math.round((minOrder - subtotal) * 100) / 100,
        },
        { status: 400 }
      );
    }

    // Out-of-stock items are dropped entirely now that the buyer has chosen
    // to continue without them.
    await service.from("order_items").delete().eq("order_id", order.id).eq("out_of_stock", true);

    const total = subtotal + Number(order.delivery_fee) + Number(order.other_charges);
    const { error } = await service
      .from("orders")
      .update({ subtotal, total, status: "accepted", updated_at: now() })
      .eq("id", order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: "accepted", subtotal, total });
  }
);
