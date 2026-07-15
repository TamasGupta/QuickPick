"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike } from "lucide-react";
import { Spinner } from "@/components/Loader";

export function CreateRiderForm() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: "", full_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/admin/riders/create", {
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
    setSuccess(`Delivery partner created — ${json.phone} can now log in and land on their dashboard.`);
    setForm({ phone: "", full_name: "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-2.5 p-4">
      <h3 className="flex items-center gap-1.5 font-bold text-ink">
        <Bike className="h-4 w-4 text-accent-600" /> Add a delivery partner
      </h3>
      <input
        className="input"
        placeholder="10-digit mobile"
        required
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
      />
      <input
        className="input"
        placeholder="Full name"
        required
        value={form.full_name}
        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-brand-700">{success}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? <Spinner /> : "Create delivery partner"}
      </button>
    </form>
  );
}
