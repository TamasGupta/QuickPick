"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike } from "lucide-react";
import { Spinner } from "@/components/Loader";
import { notify } from "@/store/notify";

export function CreateRiderForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", phone: "", full_name: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/riders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      notify.error(json.error ?? "Something went wrong");
      return;
    }
    notify.success(`Delivery partner created — +91 ${form.phone} can now log in via WhatsApp.`);
    setForm({ email: "", phone: "", full_name: "" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-2.5 p-4">
      <h3 className="flex items-center gap-1.5 font-bold text-ink">
        <Bike className="h-4 w-4 text-accent-600" /> Add a delivery partner
      </h3>
      <input
        className="input"
        placeholder="Full name"
        required
        value={form.full_name}
        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
      />
      <input
        className="input"
        placeholder="Mobile number (10-digit, login identity)"
        required
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
      />
      <input
        className="input"
        type="email"
        placeholder="Email (optional)"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? <Spinner /> : "Create delivery partner"}
      </button>
    </form>
  );
}
