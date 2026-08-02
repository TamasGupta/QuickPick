import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";
import { sendPushToUser, ORDER_STATUS_PUSH_COPY } from "@/lib/push";
import type { OrderStatus } from "@/lib/types";

const ALLOWED: OrderStatus[] = [
  "accepted",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

// POST /api/orders/:id/status — seller/admin advances the order status.
// RLS on `orders` ensures only the owning seller (or admin) can update.
export const POST = withApiLogging(
  "/api/orders/[id]/status",
  async (req: Request, { params }: { params: { id: string } }) => {
  const supabase = createServerSupabase();
  let {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { status } = (await req.json()) as { status: OrderStatus };
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("buyer_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  const copy = ORDER_STATUS_PUSH_COPY[status];
  if (copy && updated?.buyer_id) {
    void sendPushToUser(updated.buyer_id, {
      title: "Order update",
      body: copy,
      url: `/orders/${params.id}`,
      tag: `order-${params.id}`,
    });
  }

  return NextResponse.json({ ok: true, status });
  }
);
