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

  const body = (await req.json().catch(() => ({}))) as { order_id?: string; otp?: string; payment_mode?: "cash" | "upi"; verify_only?: boolean };
  const orderId = body.order_id;
  if (!orderId) return NextResponse.json({ error: "order_id required" }, { status: 400 });

  const service = createServiceSupabase();

  if (params.action === "claim") {
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
      .select("delivery_otp, rider_id, seller_id, buyer_id, status, payment_status, payment_mode, delivery_payment_status, razorpay_delivery_order_id, subtotal, delivery_fee, other_charges, total")
      .eq("id", orderId)
      .single();
    if (!order || order.rider_id !== user.id || order.status !== "out_for_delivery") {
      return NextResponse.json({ error: "Cannot complete this order" }, { status: 409 });
    }
    const enteredOtp = body.otp?.trim();
    const storedOtp = order.delivery_otp?.trim();
    if (!enteredOtp || enteredOtp !== storedOtp) {
      return NextResponse.json({ error: "Incorrect delivery OTP" }, { status: 422 });
    }

    // If verify_only, just confirm OTP is valid
    if (body.verify_only) {
      return NextResponse.json({ ok: true, otp_verified: true });
    }

    const isCod = order.payment_status === "cod";
    const paymentMode = body.payment_mode ?? (isCod ? "cash" : "online");

    // For UPI payments, require payment to be captured first
    if (paymentMode === "upi" && order.delivery_payment_status !== "paid") {
      return NextResponse.json(
        { error: "UPI payment not completed", require_payment: true, razorpay_order_id: order.razorpay_delivery_order_id },
        { status: 402 }
      );
    }

    // Set payment_mode and ensure payment_status is updated to paid for UPI
    const patch: Record<string, unknown> = {
      status: "delivered",
      updated_at: now(),
      payment_mode: order.payment_mode || paymentMode,
    };
    if (paymentMode === "upi" || order.delivery_payment_status === "paid") {
      patch.payment_status = "paid";
      patch.delivery_payment_status = "paid";
    }

    const { error } = await service.from("orders").update(patch).eq("id", orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Payout ledger logic
    const orderRef = orderId.slice(0, 8);
    const base = { order_id: orderId, seller_id: order.seller_id, rider_id: order.rider_id };
    let entries: Record<string, unknown>[] = [];

    if (isCod) {
      if (paymentMode === "upi") {
        // Buyer paid via UPI QR: platform received full amount
        // Platform owes seller (subtotal) + rider (delivery_fee), keeps other_charges
        entries = [
          {
            ...base,
            from_party: "admin",
            to_party: "seller",
            amount: order.subtotal,
            label: `Product payout — order #${orderRef} (COD UPI)`,
          },
          {
            ...base,
            from_party: "admin",
            to_party: "rider",
            amount: order.delivery_fee,
            label: `Delivery payout — order #${orderRef} (COD UPI)`,
          },
        ];
      } else {
        // Cash: rider collected full amount from buyer
        // Rider keeps delivery_fee, owes (subtotal + other_charges) to platform
        entries = [
          {
            ...base,
            from_party: "rider",
            to_party: "admin",
            amount: order.subtotal + order.other_charges,
            label: `Remittance due — order #${orderRef} (COD cash collected by rider)`,
          },
          {
            ...base,
            from_party: "admin",
            to_party: "rider",
            amount: order.delivery_fee,
            label: `Delivery payout — order #${orderRef} (COD cash)`,
          },
        ];
      }
    } else {
      // Online order: platform already holds full amount
      entries = [
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
    }

    const { error: ledgerErr } = await service.from("ledger_entries").insert(entries);
    if (ledgerErr) console.error("[rider/deliver] ledger insert failed", ledgerErr.message);

    // If COD cash, set up rider remittance due
    if (isCod && paymentMode === "cash") {
      await service
        .from("orders")
        .update({
          rider_remittance_due: order.subtotal + order.other_charges,
          rider_remittance_status: "pending",
        })
        .eq("id", orderId);
    }

    void sendPushToUser(order.buyer_id, {
      title: "Order delivered",
      body: ORDER_STATUS_PUSH_COPY.delivered!,
      url: `/orders/${orderId}`,
      tag: `order-${orderId}`,
    });

    return NextResponse.json({
      ok: true,
      payment_mode: paymentMode,
      remittance_due: isCod && paymentMode === "cash" ? order.subtotal + order.other_charges : 0,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
);