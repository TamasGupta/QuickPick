import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/apiLogger";

// DELETE /api/products/:id — deletes a product
// Caller must be an admin or the seller owning the product.
export const DELETE = withApiLogging(
  "/api/products/[id]",
  async (_req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if the user has admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    // Fetch the product to identify ownership
    const { data: product, error: fetchErr } = await supabase
      .from("products")
      .select("id, seller_id, name")
      .eq("id", params.id)
      .single();

    if (fetchErr || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // If not admin, verify that the logged-in user owns the seller store
    if (!isAdmin) {
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("id", product.seller_id)
        .eq("owner_id", user.id)
        .single();

      if (!seller) {
        return NextResponse.json(
          { error: "Unauthorized: You do not own this product" },
          { status: 403 }
        );
      }
    }

    // Use service role to cleanly delete dependent records and product row
    const service = createServiceSupabase();

    // 1. Delete product_restrictions if present
    await service.from("product_restrictions").delete().eq("product_id", params.id);

    // 2. Delete the product
    const { error: delErr } = await service.from("products").delete().eq("id", params.id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: params.id });
  }
);
