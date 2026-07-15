"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { Spinner } from "@/components/Loader";

export function CreateSellerForm() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: "", full_name: "", store_name: "", city: "", pincode: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/admin/sellers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      return;
    }
    setSuccess(`Seller created — ${json.phone} can now log in and land on their dashboard.`);
    setForm({ phone: "", full_name: "", store_name: "", city: "", pincode: "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-2.5 p-4">
      <h3 className="flex items-center gap-1.5 font-bold text-ink">
        <Store className="h-4 w-4 text-brand-600" /> Add a seller
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input"
          placeholder="10-digit mobile"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
        />
        <input
          className="input"
          placeholder="Owner name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
      </div>
      <input
        className="input"
        placeholder="Store name"
        required
        value={form.store_name}
        onChange={(e) => setForm({ ...form, store_name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input"
          placeholder="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <input
          className="input"
          placeholder="Pincode"
          value={form.pincode}
          onChange={(e) => setForm({ ...form, pincode: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-brand-700">{success}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? <Spinner /> : "Create seller"}
      </button>
    </form>
  );
}
