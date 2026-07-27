import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

const now = () => new Date().toISOString();

// Seller can still act while the order is in any of these states — once a
// rider has it (out_for_delivery/delivered) or it's already cancelled/
// paused, reporting a fresh stock issue doesn't make sense.
const REPORTABLE = ["placed", "accepted", "packed"];

// POST /api/orders/:id/report-issue — seller reports a stock problem.
// Either a full cancel (fullCancel: true, reason) or specific items flagged
// out of stock (items: [{ order_item_id, reason }]), which pauses the order
// in 'action_required' for the buyer to resolve via /resolve-issue.
export const POST = withApiLogging(
  "/api/orders/[id]/report-issue",
  async (req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      fullCancel?: boolean;
      reason?: string;
      items?: { order_item_id: string; reason: string }[];
    };

    const service = createServiceSupabase();

    const { data: order } = await service
      .from("orders")
      .select("id, seller_id, status")
      .eq("id", params.id)
      .single();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const { data: seller } = await service
      .from("sellers")
      .select("id")
      .eq("id", order.seller_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!seller) return NextResponse.json({ error: "Not your order" }, { status: 403 });

    if (!REPORTABLE.includes(order.status)) {
      return NextResponse.json({ error: "This order can no longer be modified" }, { status: 409 });
    }

    if (body.fullCancel) {
      if (!body.reason?.trim()) {
        return NextResponse.json({ error: "A reason is required to cancel the order" }, { status: 400 });
      }
      const { error } = await service
        .from("orders")
        .update({ status: "cancelled", cancel_reason: body.reason.trim(), updated_at: now() })
        .eq("id", order.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    if (!body.items?.length) {
      return NextResponse.json({ error: "Select at least one item, or cancel the whole order" }, { status: 400 });
    }

    // Make sure every flagged item actually belongs to this order — never
    // trust order_item_ids from the client at face value.
    const { data: orderItems } = await service
      .from("order_items")
      .select("id")
      .eq("order_id", order.id);
    const validIds = new Set((orderItems ?? []).map((i) => i.id));
    for (const it of body.items) {
      if (!validIds.has(it.order_item_id)) {
        return NextResponse.json({ error: "One or more items don't belong to this order" }, { status: 400 });
      }
    }

    await Promise.all(
      body.items.map((it) =>
        service
          .from("order_items")
          .update({ out_of_stock: true, oos_reason: it.reason?.trim() || "Out of stock" })
          .eq("id", it.order_item_id)
      )
    );

    const { error } = await service
      .from("orders")
      .update({ status: "action_required", updated_at: now() })
      .eq("id", order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: "action_required" });
  }
);
