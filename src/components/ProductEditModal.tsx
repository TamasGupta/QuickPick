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
    max_order_qty: product.max_order_qty != null ? String(product.max_order_qty) : "",
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
      // Uploads to Cloudinary via our own API route rather than Supabase
      // Storage — the route re-verifies (server-side, via RLS-scoped select)
      // that this caller actually owns the product before accepting the
      // file, same boundary the old storage RLS policy enforced.
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/products/${product.id}/image`, { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setImageUrl(json.url);
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
    const maxOrderQtyVal =
      form.max_order_qty.trim() === "" ? null : Number(form.max_order_qty);

    if (maxOrderQtyVal !== null && (isNaN(maxOrderQtyVal) || maxOrderQtyVal <= 0)) {
      notify.error("Max quantity per order must be a positive number.");
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

    // Try updating with max_order_qty, fallback without it if column not yet in DB
    let result = await supabase
      .from("products")
      .update({ ...payload, max_order_qty: maxOrderQtyVal })
      .eq("id", product.id)
      .select()
      .single();

    if (result.error && result.error.message.includes("max_order_qty")) {
      result = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .select()
        .single();
    }

    // Sync product_restrictions table
    try {
      if (maxOrderQtyVal && maxOrderQtyVal > 0) {
        await supabase
          .from("product_restrictions")
          .upsert({ product_id: product.id, max_qty: maxOrderQtyVal, updated_at: new Date().toISOString() });
      } else {
        await supabase
          .from("product_restrictions")
          .delete()
          .eq("product_id", product.id);
      }
    } catch {
      // ignore
    }

    setSaving(false);
    if (result.error) {
      notify.error(result.error.message);
      return;
    }
    notify.success("Product updated");
    onSaved({ ...(result.data as Product), max_order_qty: maxOrderQtyVal });
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
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Product Image</label>
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Product Name *</label>
            <input
              className="input"
              placeholder="e.g. Taaza Fresh Milk"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Brand</label>
              <input
                className="input"
                placeholder="e.g. Amul"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Category</label>
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Description</label>
            <textarea
              className="input"
              placeholder="Brief description of the product"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Selling Price (₹) *</label>
              <input
                className="input"
                type="number"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                MRP (₹) <span className="text-ink-faint font-normal">(Optional)</span>
              </label>
              <input
                className="input"
                type="number"
                placeholder="0.00"
                value={form.mrp}
                onChange={(e) => setForm({ ...form, mrp: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Unit / Pack</label>
              <input
                className="input"
                placeholder="e.g. 500 ml"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">SKU Code</label>
              <input
                className="input"
                placeholder="e.g. AML-500"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Stock Qty *</label>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              Max Qty per Order <span className="text-ink-faint font-normal">(Cart restriction, optional)</span>
            </label>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="e.g. 2 or 5 (Leave blank for no limit)"
              value={form.max_order_qty}
              onChange={(e) => setForm({ ...form, max_order_qty: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Limits how many units of this product a buyer can add to their cart in a single order.
            </p>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Visible to buyers on store
            </label>
          </div>
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
