"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
  Receipt,
  ShoppingCart,
  ShieldAlert,
  Search,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Package,
} from "lucide-react";
import { inr } from "@/lib/utils";
import { notify } from "@/store/notify";
import { Spinner } from "@/components/Loader";
import type { AppSettings, ProductRestriction } from "@/lib/types";

interface Props {
  initialSettings: AppSettings;
  initialRestrictions: ProductRestriction[];
}

interface SearchProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit?: string | null;
  image_url?: string | null;
  seller_id?: string;
  sellers?: { store_name: string } | null;
}

export function AdminSettingsView({ initialSettings, initialRestrictions }: Props) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [restrictions, setRestrictions] = useState<ProductRestriction[]>(initialRestrictions);
  const [savingSettings, setSavingSettings] = useState(false);

  // Product restriction adder state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [restrictionQty, setRestrictionQty] = useState("2");
  const [addingRestriction, setAddingRestriction] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search debounce
  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/products/suggest?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults((json.products ?? []) as SearchProduct[]);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }

  // Save global platform settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_fee: Number(settings.delivery_fee),
          other_charges: Number(settings.other_charges),
          min_order_amount: Number(settings.min_order_amount),
          max_cart_items: Number(settings.max_cart_items),
          max_qty_per_product: Number(settings.max_qty_per_product),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setSettings(data.settings);
      notify.success("Platform settings updated successfully");
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  }

  // Add or update restriction on specific product
  async function handleAddRestriction() {
    if (!selectedProduct) {
      notify.error("Please search and select a product first.");
      return;
    }
    const maxQty = Number(restrictionQty);
    if (isNaN(maxQty) || maxQty <= 0) {
      notify.error("Please enter a valid positive quantity limit.");
      return;
    }

    setAddingRestriction(true);
    try {
      const res = await fetch("/api/admin/settings/restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          max_qty: maxQty,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add restriction");

      const created: ProductRestriction = data.restriction ?? {
        product_id: selectedProduct.id,
        max_qty: maxQty,
        created_at: new Date().toISOString(),
        products: {
          id: selectedProduct.id,
          name: selectedProduct.name,
          price: selectedProduct.price,
          stock: selectedProduct.stock,
          image_url: selectedProduct.image_url ?? null,
          unit: selectedProduct.unit ?? null,
          brand: null,
          sellers: selectedProduct.sellers ?? null,
        },
      };

      setRestrictions((prev) => {
        const filtered = prev.filter((r) => r.product_id !== selectedProduct.id);
        return [created, ...filtered];
      });

      setSelectedProduct(null);
      setSearchQuery("");
      setSearchResults([]);
      setRestrictionQty("2");
      notify.success(`Set limit of ${maxQty} per order for ${selectedProduct.name}`);
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setAddingRestriction(false);
    }
  }

  // Remove restriction
  async function handleRemoveRestriction(productId: string, productName?: string) {
    if (!confirm(`Remove order quantity restriction on "${productName ?? "this product"}"?`)) return;

    setDeletingId(productId);
    try {
      const res = await fetch(`/api/admin/settings/restrictions/${productId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove restriction");
      }

      setRestrictions((prev) => prev.filter((r) => r.product_id !== productId));
      notify.success("Restriction removed");
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  // Sample order preview calculation
  const sampleSubtotal = 200;
  const sampleDelivery = Number(settings.delivery_fee) || 0;
  const sampleOther = Number(settings.other_charges) || 0;
  const sampleTotal = sampleSubtotal + sampleDelivery + sampleOther;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Admin console
          </Link>
          <h1 className="mt-1 text-xl font-extrabold text-ink">Platform & Order Settings</h1>
          <p className="text-xs text-ink-faint">
            Manage delivery fees, platform handling charges, cart thresholds, and product purchase restrictions.
          </p>
        </div>
      </div>

      {/* Grid: Global Settings & Live Bill Preview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form Column */}
        <form onSubmit={handleSaveSettings} className="space-y-6 lg:col-span-2">
          {/* Section 1: Charges */}
          <div className="card space-y-4 p-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Truck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-ink">Charges & Fees</h2>
                <p className="text-xs text-ink-faint">Configure the fees charged to buyers on every checkout.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Delivery Charges (₹)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input pl-7"
                    required
                    value={settings.delivery_fee}
                    onChange={(e) => setSettings({ ...settings, delivery_fee: Number(e.target.value) })}
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Fee credited to the delivery partner on delivered orders.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Other Charges / Handling Fee (₹)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input pl-7"
                    required
                    value={settings.other_charges}
                    onChange={(e) => setSettings({ ...settings, other_charges: Number(e.target.value) })}
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Platform handling/packaging charge retained by the platform.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Cart Limits */}
          <div className="card space-y-4 p-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-ink">Cart & Order Value Limits</h2>
                <p className="text-xs text-ink-faint">
                  Define order requirements and general quantity boundaries.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Minimum Order Amount (₹)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input pl-7"
                    required
                    value={settings.min_order_amount}
                    onChange={(e) => setSettings({ ...settings, min_order_amount: Number(e.target.value) })}
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Cart subtotal must equal or exceed this amount to place an order.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Max Distinct Cart Items
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input"
                  required
                  value={settings.max_cart_items}
                  onChange={(e) => setSettings({ ...settings, max_cart_items: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Maximum number of different products in a single cart (currently {settings.max_cart_items}).
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">
                  Default Max Qty per Product
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input"
                  required
                  value={settings.max_qty_per_product}
                  onChange={(e) => setSettings({ ...settings, max_qty_per_product: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Global limit per item when no specific product restriction is set.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="btn-primary inline-flex items-center gap-2 px-6 py-2.5"
            >
              {savingSettings ? <Spinner className="h-4 w-4 border-white" /> : <Save className="h-4 w-4" />}
              {savingSettings ? "Saving settings…" : "Save platform settings"}
            </button>
          </div>
        </form>

        {/* Live Bill Preview Column */}
        <div className="space-y-4">
          <div className="card space-y-3 p-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Receipt className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink">Buyer Bill Preview</h3>
            </div>
            <p className="text-xs text-ink-faint">
              Here is how customer bills will calculate based on your current settings:
            </p>

            <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-xs">
              <div className="flex justify-between text-ink-soft">
                <span>Items subtotal (sample)</span>
                <span>{inr(sampleSubtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Delivery charges</span>
                <span className="font-semibold text-brand-700">{inr(sampleDelivery)}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Other charges</span>
                <span className="font-semibold text-ink">{inr(sampleOther)}</span>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between text-sm font-bold text-ink">
                <span>Total to pay</span>
                <span>{inr(sampleTotal)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-brand-50 p-3 text-[11px] text-brand-800 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" /> Active Rules
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Minimum order required: <b>{inr(settings.min_order_amount)}</b></li>
                <li>Max distinct products per cart: <b>{settings.max_cart_items}</b></li>
                <li>Default product purchase cap: <b>{settings.max_qty_per_product} units</b></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Product-Specific Restrictions */}
      <div className="card space-y-5 p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">
                Product-Specific Purchase Restrictions ({restrictions.length})
              </h2>
              <p className="text-xs text-ink-faint">
                Restrict maximum units of specific items (e.g. Sugar, Onions, Milk, or flash deals) that a buyer can add to cart.
              </p>
            </div>
          </div>
        </div>

        {/* Add Restriction Panel */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Set Restriction on a Product
          </h3>

          <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
            {/* Search Box */}
            <div className="sm:col-span-7 relative">
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                1. Search Product
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                <input
                  type="text"
                  className="input pl-9 text-xs"
                  placeholder="Type product name, brand, or SKU…"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {isSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-faint">
                    Searching…
                  </span>
                )}
              </div>

              {/* Suggestions dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                  {searchResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setSelectedProduct(prod);
                        setSearchResults([]);
                        setSearchQuery(prod.name);
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs hover:bg-brand-50"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-gray-100 overflow-hidden text-sm">
                          {prod.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={prod.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            "🛍️"
                          )}
                        </span>
                        <div className="truncate">
                          <p className="font-semibold text-ink truncate">{prod.name}</p>
                          <p className="text-[10px] text-ink-faint">
                            {prod.unit ?? "unit"} · Stock {prod.stock}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-ink shrink-0 ml-2">{inr(prod.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Limit Quantity */}
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                2. Max allowed in cart
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="input text-xs"
                placeholder="e.g. 2"
                value={restrictionQty}
                onChange={(e) => setRestrictionQty(e.target.value)}
              />
            </div>

            {/* Action button */}
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={!selectedProduct || addingRestriction}
                onClick={handleAddRestriction}
                className="btn-primary w-full text-xs py-2 inline-flex items-center justify-center gap-1"
              >
                {addingRestriction ? (
                  <Spinner className="h-3.5 w-3.5 border-white" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Set limit
              </button>
            </div>
          </div>

          {selectedProduct && (
            <div className="flex items-center justify-between rounded-lg bg-brand-50/70 p-2 text-xs text-brand-900 border border-brand-100">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold">Selected:</span>
                <span className="font-bold truncate">{selectedProduct.name}</span>
                <span className="text-brand-700">({inr(selectedProduct.price)})</span>
              </div>
              <button
                type="button"
                className="text-xs text-red-600 underline font-medium"
                onClick={() => {
                  setSelectedProduct(null);
                  setSearchQuery("");
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Existing Restrictions List */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Active Restrictions ({restrictions.length})
          </h3>

          <div className="card divide-y overflow-hidden">
            {restrictions.map((r) => {
              const p = r.products;
              const isDeleting = deletingId === r.product_id;

              return (
                <div key={r.product_id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {p?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-ink-faint" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{p?.name ?? "Product"}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {p?.sellers?.store_name ?? "Store"}
                      {p?.unit && ` · ${p.unit}`}
                      {p?.price != null && ` · ${inr(p.price)}`}
                      {p?.stock != null && ` · Stock: ${p.stock}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="badge bg-red-50 text-red-700 font-bold border border-red-200 px-2 py-0.5">
                      Max {r.max_qty} / order
                    </span>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleRemoveRestriction(r.product_id, p?.name)}
                      className="btn-ghost p-1.5 text-ink-faint hover:text-red-600"
                      aria-label="Remove restriction"
                      title="Remove restriction"
                    >
                      {isDeleting ? (
                        <Spinner className="h-4 w-4 border-red-500" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {restrictions.length === 0 && (
              <div className="p-8 text-center text-sm text-ink-faint">
                <ShieldAlert className="mx-auto mb-2 h-7 w-7 text-gray-300" />
                <p className="font-semibold text-ink">No product restrictions configured</p>
                <p className="text-xs">
                  All products follow the global default cap ({settings.max_qty_per_product} units per order).
                  Use the search above to set custom restrictions on specific products.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
