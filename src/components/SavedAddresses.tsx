"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Edit2, Trash2, MapPin, Check, Map } from "lucide-react";
import type { Address } from "@/lib/types";
import type { PickedLocation } from "./LocationPicker";
import { notify } from "@/store/notify";
import { SkelLine } from "./skeletons";

const LocationPicker = dynamic(() => import("./LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center rounded-xl bg-gray-50 text-sm text-ink-faint">Loading map…</div>,
});

interface AddressFormData {
  label: string;
  line1: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
}

export function SavedAddresses() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormData>({
    label: "Home",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    is_default: false,
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  async function fetchAddresses() {
    try {
      const res = await fetch("/api/addresses");
      if (!res.ok) throw new Error("Failed to fetch addresses");
      const data = await res.json();
      setAddresses(data.addresses);
    } catch (error) {
      notify.error("Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.line1.trim() || !form.pincode.trim()) {
      notify.error("Address line and pincode are required");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/addresses/${editingId}` : "/api/addresses";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to save address");

      notify.success(editingId ? "Address updated" : "Address added");
      await fetchAddresses();
      resetForm();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this address?")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete address");
      notify.success("Address deleted");
      await fetchAddresses();
    } catch (error) {
      notify.error("Failed to delete address");
    } finally {
      setDeleting(null);
    }
  }

  function handleLocationConfirm(loc: PickedLocation) {
    setForm((prev) => ({
      ...prev,
      city: loc.city || prev.city,
      state: loc.state || prev.state,
      pincode: loc.pincode || prev.pincode,
      lat: loc.lat,
      lng: loc.lng,
    }));
    setShowMap(false);
  }

  function resetForm() {
    setForm({
      label: "Home",
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      is_default: false,
    });
    setEditingId(null);
    setShowForm(false);
    setShowMap(false);
  }

  function startEdit(addr: Address) {
    setForm({
      label: addr.label,
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode,
      lat: addr.lat || undefined,
      lng: addr.lng || undefined,
      is_default: addr.is_default,
    });
    setEditingId(addr.id);
    setShowForm(true);
  }

  if (loading) {
    return (
      <div className="card space-y-3 p-4">
        <SkelLine className="h-4 w-20" />
        <SkelLine className="h-3 w-full" />
        <SkelLine className="h-3 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Saved Addresses</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-1 px-2 py-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Label (Home, Work, etc.)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="input col-span-2 text-sm"
            />
            <input
              type="text"
              placeholder="Address line 1"
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
              required
              className="input col-span-2 text-sm"
            />
            <input
              type="text"
              placeholder="Address line 2 (optional)"
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
              className="input text-sm"
            />
            <input
              type="text"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input text-sm"
            />
            <input
              type="text"
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="input text-sm"
            />
            <input
              type="text"
              placeholder="Pincode"
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              required
              className="input text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className="btn-outline w-full flex items-center justify-center gap-2 text-sm"
          >
            <Map className="h-4 w-4" />
            {showMap ? "Hide map" : "Select on map"}
          </button>

          {showMap && (
            <div className="space-y-2">
              <LocationPicker
                initialLat={form.lat}
                initialLng={form.lng}
                onConfirm={handleLocationConfirm}
                onCancel={() => setShowMap(false)}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="checkbox"
            />
            <span>Set as default address</span>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 text-sm"
            >
              {saving ? "Saving…" : editingId ? "Update" : "Add Address"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn-outline flex-1 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-8 text-center">
          <MapPin className="h-6 w-6 text-ink-faint" />
          <p className="text-sm text-ink-soft">No saved addresses yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((addr) => (
            <div key={addr.id} className="card flex items-start gap-3 p-3">
              <MapPin className="h-4 w-4 shrink-0 text-brand-600 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{addr.label}</p>
                  {addr.is_default && (
                    <span className="badge bg-green-50 text-green-700 text-xs flex items-center gap-1">
                      <Check className="h-2.5 w-2.5" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-soft break-words">
                  {addr.line1}
                  {addr.line2 && `, ${addr.line2}`}
                </p>
                {addr.city && (
                  <p className="text-xs text-ink-faint">
                    {addr.city}
                    {addr.state && `, ${addr.state}`}
                    {addr.pincode && ` - ${addr.pincode}`}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(addr)}
                  className="btn-ghost p-2"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4 text-ink-faint hover:text-ink" />
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  disabled={deleting === addr.id}
                  className="btn-ghost p-2"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-ink-faint hover:text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
