import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { requireRider } from "@/lib/rider";
import { withApiLogging } from "@/lib/apiLogger";
import { sendPushToUser, ORDER_STATUS_PUSH_COPY } from "@/lib/push";

const now = () => new Date().toISOString();

// POST /api/rider/claim | /api/rider/pickup | /api/rider/deliver
export const POST = withApiLogging(
  "/api/rider/[action]",
  async (req: Request, { params }: { params: { action: string } }) => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await requireRider(supabase, user))) {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { order_id?: string; otp?: string };
  const orderId = body.order_id;
  if (!orderId) return NextResponse.json({ error: "order_id required" }, { status: 400 });

  const service = createServiceSupabase();

  if (params.action === "claim") {
    // Atomic claim: only succeeds if still packed & unassigned.
    const { data, error } = await service
      .from("orders")
      .update({ rider_id: user.id, updated_at: now() })
      .eq("id", orderId)
      .eq("status", "packed")
      .is("rider_id", null)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) {
      return NextResponse.json({ error: "Order was already taken" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (params.action === "pickup") {
    const { data, error } = await service
      .from("orders")
      .update({ status: "out_for_delivery", updated_at: now() })
      .eq("id", orderId)
      .eq("rider_id", user.id)
      .eq("status", "packed")
      .select("id, buyer_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Cannot pick up this order" }, { status: 409 });

    void sendPushToUser(data[0].buyer_id, {
      title: "Order update",
      body: ORDER_STATUS_PUSH_COPY.out_for_delivery!,
      url: `/orders/${orderId}`,
      tag: `order-${orderId}`,
    });

    return NextResponse.json({ ok: true });
  }

  if (params.action === "deliver") {
    // Verify the buyer's delivery OTP before completing.
    const { data: order } = await service
      .from("orders")
      .select(
        "delivery_otp, rider_id, seller_id, buyer_id, status, payment_status, delivery_payment_method, subtotal, delivery_fee, other_charges"
      )
      .eq("id", orderId)
      .single();
    if (!order || order.rider_id !== user.id || order.status !== "out_for_delivery") {
      return NextResponse.json({ error: "Cannot complete this order" }, { status: 409 });
    }
    if (!body.otp || body.otp.trim() !== order.delivery_otp) {
      return NextResponse.json({ error: "Incorrect delivery OTP" }, { status: 422 });
    }

    // Checkout is COD-only now — payment is resolved at the door instead
    // (see /api/rider/payment/method). Delivery can't complete until that's
    // settled: either the buyer paid cash (delivery_payment_method flips to
    // 'cash' immediately, no further wait) or the QR was scanned and the
    // webhook confirmed it (payment_status flips to 'paid', so stillCod is
    // false by the time we get here).
    const stillCod = order.payment_status === "cod";
    if (stillCod && order.delivery_payment_method !== "cash") {
      return NextResponse.json(
        {
          error:
            "Choose how the buyer is paying — cash, or wait for the QR payment to confirm — before completing delivery.",
        },
        { status: 409 }
      );
    }

    const patch: Record<string, unknown> = { status: "delivered", updated_at: now() };
    const { error } = await service.from("orders").update(patch).eq("id", orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Payout ledger — exactly the money that needs to change hands now that
    // the order is delivered (see migration 011 for the original reasoning,
    // migration 021 for why the cash case's direction flipped once checkout
    // stopped taking online payments). Paid (QR scanned at the door, or a
    // legacy checkout-time online order) — the platform already holds the
    // full `total`, so it owes the seller + rider their shares. Still cod at
    // delivery — the buyer paid the RIDER cash directly, so the rider now
    // owes the seller + platform their shares; they keep `delivery_fee` out
    // of what they collected as their own earning, no entry needed for
    // money they already hold.
    const orderRef = orderId.slice(0, 8);
    const base = { order_id: orderId, seller_id: order.seller_id, rider_id: order.rider_id };
    const entries = stillCod
      ? [
          {
            ...base,
            from_party: "rider",
            to_party: "seller",
            amount: order.subtotal,
            label: `Product payout — order #${orderRef} (cash collected by rider)`,
          },
          {
            ...base,
            from_party: "rider",
            to_party: "admin",
            amount: order.other_charges,
            label: `Platform fee — order #${orderRef} (cash collected by rider)`,
          },
        ]
      : [
          {
            ...base,
            from_party: "admin",
            to_party: "seller",
            amount: order.subtotal,
            label: `Product payout — order #${orderRef}`,
          },
          {
            ...base,
            from_party: "admin",
            to_party: "rider",
            amount: order.delivery_fee,
            label: `Delivery payout — order #${orderRef}`,
          },
        ];
    const { error: ledgerErr } = await service.from("ledger_entries").insert(entries);
    if (ledgerErr) console.error("[rider/deliver] ledger insert failed", ledgerErr.message);

    void sendPushToUser(order.buyer_id, {
      title: "Order delivered",
      body: ORDER_STATUS_PUSH_COPY.delivered!,
      url: `/orders/${orderId}`,
      tag: `order-${orderId}`,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
);
