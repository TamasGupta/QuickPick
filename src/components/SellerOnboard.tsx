"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Shown when a logged-in user has no seller store yet.
export function SellerOnboard() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({ store_name: "", phone: "", city: "", pincode: "", address_line: "" });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    // Mark this profile as a seller and create the store (pending approval).
    await supabase.from("profiles").update({ role: "seller" }).eq("id", user.id);
    const { error } = await supabase.from("sellers").insert({ ...form, owner_id: user.id });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-xl font-extrabold text-brand-700">Sell on QuickPick</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create your store. Once approved by our team, you can list products and receive orders.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input className="input" placeholder="Store name" required
            value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
          <input className="input" placeholder="Phone" required
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Store address"
            value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="City"
              value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className="input" placeholder="Pincode"
              value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating…" : "Create store"}
          </button>
        </form>
      </div>
    </div>
  );
}
