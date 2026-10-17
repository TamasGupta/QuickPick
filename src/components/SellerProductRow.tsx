"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/store/notify";
import { ProductEditModal } from "@/components/ProductEditModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import type { Product } from "@/lib/types";

export function SellerProductRow({
  product: initial,
  onDelete,
  onUpdate,
}: {
  product: Product;
  onDelete?: (id: string) => void;
  onUpdate?: (updated: Product) => void;
}) {
  const supabase = createClient();
  const [product, setProduct] = useState(initial);
  const [price, setPrice] = useState(initial.price);
  const [stock, setStock] = useState(initial.stock);
  const [active, setActive] = useState(initial.is_active);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ price, stock, is_active: active })
      .eq("id", product.id);
    setSaving(false);
    if (error) {
      notify.error(error.message);
      return;
    }
    notify.success("Product updated");
    const updated = { ...product, price, stock, is_active: active };
    setProduct(updated);
    onUpdate?.(updated);
    setDirty(false);
  }

  async function toggle() {
    const next = !active;
    setActive(next);
    const { error } = await supabase.from("products").update({ is_active: next }).eq("id", product.id);
    if (error) {
      setActive(!next);
      notify.error(error.message);
    } else {
      const updated = { ...product, is_active: next };
      setProduct(updated);
      onUpdate?.(updated);
    }
  }

  function handleSaved(updated: Product) {
    setProduct(updated);
    setPrice(updated.price);
    setStock(updated.stock);
    setActive(updated.is_active);
    setDirty(false);
    onUpdate?.(updated);
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to delete product");
      }
      notify.success("Product deleted successfully");
      setConfirmingDelete(false);
      onDelete?.(product.id);
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto sm:flex-1">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" className="h-full w-full rounded-lg object-cover" />
          ) : (
            "🛍️"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <p className="text-xs text-gray-500">{product.brand} · {product.unit}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">
          Price
          <input
            type="number"
            value={price}
            onChange={(e) => { setPrice(Number(e.target.value)); setDirty(true); }}
            className="ml-1 w-20 rounded border px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-gray-500">
          Stock
          <input
            type="number"
            value={stock}
            onChange={(e) => { setStock(Number(e.target.value)); setDirty(true); }}
            className="ml-1 w-16 rounded border px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={toggle}
          className={`badge ${active ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-500"}`}
        >
          {active ? "Active" : "Hidden"}
        </button>
        {dirty && (
          <button className="btn-primary py-1" disabled={saving} onClick={save}>
            {saving ? "…" : "Save"}
          </button>
        )}
        <button className="btn-ghost p-1.5" onClick={() => setEditing(true)} aria-label="Edit product" title="Edit product">
          <Pencil className="h-4 w-4" />
        </button>
        <button
          className="btn-ghost p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => setConfirmingDelete(true)}
          aria-label="Delete product"
          title="Delete product"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <ProductEditModal
          product={product}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
          onDelete={onDelete}
        />
      )}

      <ConfirmDeleteModal
        isOpen={confirmingDelete}
        productName={product.name}
        loading={deleting}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
