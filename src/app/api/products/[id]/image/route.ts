import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { uploadProductImage } from "@/lib/cloudinary";
import { cacheKeyFor } from "@/lib/productImage";
import { withApiLogging } from "@/lib/apiLogger";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// POST /api/products/:id/image — uploads a seller's product photo to
// Cloudinary and returns its URL (the caller still saves that URL onto the
// product row via the existing products.update() call — this route just
// handles the file itself, plus feeding it into product_image_cache so
// other sellers' listings of the same brand+name+unit benefit from it too).
//
// Ownership check: rather than a separate seller/admin lookup, this just
// selects the product through the RLS-scoped client — the products_read
// policy already only returns a row to its owning seller or an admin, so a
// caller who isn't either gets no row back here, same boundary the old
// Supabase Storage RLS policy enforced for the upload path itself.
export const POST = withApiLogging(
  "/api/products/[id]/image",
  async (req: Request, { params }: { params: { id: string } }) => {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, seller_id, name, brand, unit")
      .eq("id", params.id)
      .single();
    if (productErr || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be under 5 MB" }, { status: 400 });
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadProductImage(buffer, product.seller_id);

      // Feed this real, verified photo into the shared image cache so any
      // other seller listing the same brand+name+unit gets it instead of an
      // Apify/Google Images lookup — best-effort, never blocks the response
      // the seller is waiting on for their own upload.
      try {
        const service = createServiceSupabase();
        await service.from("product_image_cache").upsert(
          {
            cache_key: cacheKeyFor(product.name, product.brand, product.unit),
            image_url: url,
            checked_at: new Date().toISOString(),
          },
          { onConflict: "cache_key" }
        );
      } catch (cacheErr) {
        console.error("[products/image] cache upsert failed", (cacheErr as Error).message);
      }

      return NextResponse.json({ url });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }
);
