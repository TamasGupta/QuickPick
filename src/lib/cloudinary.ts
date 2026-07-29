// Server-only Cloudinary upload helper for seller product photos.
//
// Supabase Storage was the original home for these (see migration 008 and
// the `product-images` bucket in schema.sql) — moved here because storage
// egress/quota on the Supabase project scales with every seller's product
// catalog, while Cloudinary is built for exactly this (image CDN + on-the-fly
// transformations) and has a generous free tier. Uploads still route through
// our own server rather than a client-side unsigned preset, so the same
// "seller can only touch their own product" authorization check that RLS
// used to provide for the storage bucket is preserved here in application
// code (see the route that calls uploadProductImage).
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Appends Cloudinary's on-the-fly transformation params (auto format/quality,
// capped width) to a delivery URL so every consumer gets an optimized image
// without needing its own resizing logic — Cloudinary generates and caches
// the transformed variant on first request.
function withDefaultTransform(url: string): string {
  return url.replace("/upload/", "/upload/f_auto,q_auto,w_800/");
}

export async function uploadProductImage(buffer: Buffer, sellerId: string): Promise<string> {
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `product-images/${sellerId}`,
        resource_type: "image",
        // Seller-uploaded photos are user-facing storefront content — no
        // reason to keep the original filename/metadata around.
        use_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
        resolve(result);
      }
    );
    stream.end(buffer);
  });
  return withDefaultTransform(result.secure_url);
}
