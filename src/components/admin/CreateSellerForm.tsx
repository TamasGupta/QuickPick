"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, MapPin, Link2 } from "lucide-react";
import { Spinner } from "@/components/Loader";
import { notify } from "@/store/notify";

export function CreateSellerForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    phone: "",
    full_name: "",
    store_name: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "done" | "error">("idle");
  const [mapsLink, setMapsLink] = useState("");
  const [linkStatus, setLinkStatus] = useState<"idle" | "resolving" | "error">("idle");
  const [loading, setLoading] = useState(false);

  // Fills city/state/pincode from resolved coordinates, but only into fields
  // the admin hasn't already typed something into.
  function applyLocation(loc: { lat: number; lng: number; city?: string | null; state?: string | null; pincode?: string | null }) {
    setCoords({ lat: loc.lat, lng: loc.lng });
    setForm((f) => ({
      ...f,
      city: f.city || loc.city || "",
      state: f.state || loc.state || "",
      pincode: f.pincode || loc.pincode || "",
    }));
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      notify.error("Geolocation isn't supported in this browser.");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setGeoStatus("done");
        try {
          const res = await fetch("/api/geo/reverse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng }),
          });
          if (res.ok) applyLocation({ lat, lng, ...(await res.json()) });
        } catch {
          // Coordinates are still captured — city/state/pincode just stay
          // whatever the admin already typed (or blank, editable manually).
        }
      },
      (err) => {
        console.error("Seller location detection failed:", err.code, err.message);
        const messages: Record<number, string> = {
          1: "Location permission was denied. Enable it in your browser/site settings.",
          2: "Couldn't determine a location right now.",
          3: "Location request timed out — try again.",
        };
        setGeoStatus("error");
        notify.error(messages[err.code] ?? err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function useMapsLink() {
    setLinkStatus("resolving");
    try {
      const res = await fetch("/api/geo/resolve-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mapsLink.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLinkStatus("error");
        notify.error(json.error ?? "Couldn't resolve that link.");
        return;
      }
      applyLocation(json);
      setGeoStatus("done");
      setLinkStatus("idle");
      setMapsLink("");
    } catch {
      setLinkStatus("error");
      notify.error("Couldn't resolve that link — check your connection and try again.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/sellers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, lat: coords?.lat ?? null, lng: coords?.lng ?? null }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      notify.error(json.error ?? "Something went wrong");
      return;
    }
    notify.success(`Seller created — ${json.email} can now log in and land on their dashboard.`);
    setForm({ email: "", phone: "", full_name: "", store_name: "", city: "", state: "", pincode: "" });
    setCoords(null);
    setGeoStatus("idle");
    setMapsLink("");
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
          type="email"
          placeholder="Login email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
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
        placeholder="Contact phone (10-digit, optional)"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
      />
      <input
        className="input"
        placeholder="Store name"
        required
        value={form.store_name}
        onChange={(e) => setForm({ ...form, store_name: e.target.value })}
      />
      <div className="grid grid-cols-3 gap-2">
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
          className="input"
          placeholder="Pincode"
          value={form.pincode}
          onChange={(e) => setForm({ ...form, pincode: e.target.value })}
        />
      </div>

      <div className="space-y-2 rounded-xl border border-gray-100 p-2.5">
        <p className="text-xs font-semibold text-ink-soft">
          Store location <span className="text-ink-faint">(needed for the 10km delivery radius — also fills city/state/pincode above)</span>
        </p>

        <button
          type="button"
          onClick={detectLocation}
          className={`btn-outline w-full text-sm ${geoStatus === "done" ? "border-brand-500 text-brand-700" : ""}`}
        >
          <MapPin className="h-3.5 w-3.5" />
          {geoStatus === "locating"
            ? "Locating…"
            : geoStatus === "done" && coords
              ? "Location pinned"
              : "Use current location (if at the store)"}
        </button>
        {geoStatus === "done" && coords && (
          <p className="text-[11px] text-brand-700">📍 Pinned at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
        )}

        <p className="text-center text-[11px] text-ink-faint">— or, if you're not at the store —</p>

        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Paste a Google Maps link to the store"
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
          />
          <button
            type="button"
            onClick={useMapsLink}
            className="btn-outline shrink-0 px-3 text-sm"
            disabled={!mapsLink.trim() || linkStatus === "resolving"}
          >
            {linkStatus === "resolving" ? (
              <Spinner className="h-3.5 w-3.5 border-ink/30 border-t-ink" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-ink-faint">
          In Google Maps: search the store, drop a pin, tap Share → Copy link. Shortened links work too.
        </p>
      </div>

      <button className="btn-primary w-full" disabled={loading}>
        {loading ? <Spinner /> : "Create seller"}
      </button>
    </form>
  );
}
