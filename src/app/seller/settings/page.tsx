"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SellerNav } from "@/components/SellerNav";
import { SkelLine } from "@/components/skeletons";
import { notify } from "@/store/notify";
import type { Seller } from "@/lib/types";
import type { PickedLocation } from "@/components/LocationPicker";

const LocationPicker = dynamic(() => import("@/components/LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center rounded-xl bg-gray-50 text-sm text-ink-faint">Loading map…</div>,
});

export default function SellerSettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState({ store_name: "", address_line: "", city: "", state: "", pincode: "" });
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const { data: s } = await supabase.from("sellers").select("*").eq("owner_id", data.user.id).maybeSingle();
      if (s) {
        const seller = s as Seller;
        setSeller(seller);
        setForm({
          store_name: seller.store_name,
          address_line: seller.address_line ?? "",
          city: seller.city ?? "",
          state: seller.state ?? "",
          pincode: seller.pincode ?? "",
        });
        if (seller.lat != null && seller.lng != null) {
          setPicked({ lat: seller.lat, lng: seller.lng, city: seller.city, state: seller.state, pincode: seller.pincode });
        }
      }
      setLoading(false);
    });
  }, [supabase, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!seller) return;
    setSaving(true);
    const update = {
      ...form,
      lat: picked?.lat ?? null,
      lng: picked?.lng ?? null,
    };
    const { error } = await supabase.from("sellers").update(update).eq("id", seller.id);
    setSaving(false);
    if (error) return notify.error(error.message);
    notify.success("Store details updated");
  }

  if (loading) {
    return (
      <div>
        <SellerNav />
        <div className="card mx-auto max-w-md space-y-3 p-4">
          <SkelLine className="h-4 w-36" />
          <SkelLine className="h-9 w-full rounded-xl" />
          <SkelLine className="h-9 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div>
        <SellerNav />
        <p className="text-sm text-ink-soft">This account isn't set up as a seller.</p>
      </div>
    );
  }

  return (
    <div>
      <SellerNav />
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-xl font-extrabold">Store settings</h1>
        <form onSubmit={save} className="card grid grid-cols-2 gap-2 p-4">
          <input
            className="input col-span-2"
            placeholder="Store name"
            required
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
          />
          <input
            className="input col-span-2"
            placeholder="Address line"
            value={form.address_line}
            onChange={(e) => setForm({ ...form, address_line: e.target.value })}
          />
          <input
            className="input"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <input
            className="input"
            placeholder="State"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />
          <input
            className="input col-span-2"
            placeholder="Pincode"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
          />

          {showMap ? (
            <div className="col-span-2">
              <LocationPicker
                initialLat={picked?.lat}
                initialLng={picked?.lng}
                onCancel={() => setShowMap(false)}
                onConfirm={(loc) => {
                  setPicked(loc);
                  setForm((f) => ({
                    ...f,
                    city: f.city || loc.city || "",
                    state: f.state || loc.state || "",
                    pincode: f.pincode || loc.pincode || "",
                  }));
                  setShowMap(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className={`btn-outline col-span-2 ${picked ? "border-brand-500 text-brand-700" : ""}`}
            >
              <MapPin className="h-4 w-4" />
              {picked ? "Store location pinned — tap to adjust" : "Pin store location on map"}
            </button>
          )}
          <p className="col-span-2 -mt-1 text-[11px] text-ink-faint">
            Pinning your store's exact location improves delivery distance estimates for buyers.
          </p>

          <button className="btn-primary col-span-2" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
