import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
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
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { status } = (await req.json()) as { status: OrderStatus };
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, status });
}
