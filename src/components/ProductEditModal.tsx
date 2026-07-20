"use client";

import { useEffect, useState } from "react";
import { X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/store/notify";
import { Spinner } from "@/components/Loader";
import type { Product } from "@/lib/types";

const MAX_IMAGE_MB = 5;

export function ProductEditModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (updated: Product) => void;
}) {
  const supabase = createClient();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand ?? "",
    description: product.description ?? "",
    category_id: product.category_id ?? "",
    price: String(product.price),
    mrp: product.mrp != null ? String(product.mrp) : "",
    unit: product.unit ?? "",
    sku: product.sku ?? "",
    stock: String(product.stock),
    is_active: product.is_active,
  });
  const [imageUrl, setImageUrl] = useState(product.image_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, [supabase]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      notify.error(`Image must be under ${MAX_IMAGE_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      // Path is scoped to the product's own seller folder — matches the
      // storage RLS policy in migration 008, which only lets a seller write
      // inside <their seller id>/ (or an admin write anywhere).
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${product.seller_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      notify.error("Product name is required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      price: Number(form.price),
      mrp: form.mrp.trim() === "" ? null : Number(form.mrp),
      unit: form.unit.trim() || null,
      sku: form.sku.trim() || null,
      stock: Number(form.stock),
      is_active: form.is_active,
      image_url: imageUrl,
      // Manually uploading/replacing the photo makes this a seller-provided
      // image from now on — it should stop being touched by the auto-fetch
      // refresh job (see lib/productImage.ts).
      image_source: imageUrl !== product.image_url ? "seller" : product.image_source,
    };
    const { data, error } = await supabase.from("products").update(payload).eq("id", product.id).select().single();
    setSaving(false);
    if (error) {
      notify.error(error.message);
      return;
    }
    notify.success("Product updated");
    onSaved(data as Product);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-ink">Edit product</h3>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl opacity-50">🛍️</span>
              )}
            </div>
            <label className="btn-outline cursor-pointer text-sm">
              {uploading ? (
                <Spinner className="h-4 w-4 border-brand-200 border-t-brand-600" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading…" : "Upload image"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
          </div>

          <input
            className="input"
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Brand"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
            <select
              className="input"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input"
            placeholder="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              type="number"
              placeholder="Price"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="MRP (optional)"
              value={form.mrp}
              onChange={(e) => setForm({ ...form, mrp: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              className="input"
              placeholder="Unit (e.g. 500 ml)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <input
              className="input"
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Stock"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Visible to buyers
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn-outline flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
