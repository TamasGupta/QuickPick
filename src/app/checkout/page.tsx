"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, TriangleAlert, Pencil, Trash2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/store/cart";
import { inr } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { haversineKm, MAX_DELIVERY_RADIUS_KM } from "@/lib/geo";
import { SkelLine } from "@/components/skeletons";
import { notify } from "@/store/notify";
import type { Address, StoreHoursStatus } from "@/lib/types";
import type { PickedLocation } from "@/components/LocationPicker";

// ─── Store-hours helpers ─────────────────────────────────────────────────────



// Format a DB time string "HH:MM:SS" into "9:00 AM".
function fmtTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// Return a human-readable description of today's hours from the schedule.
// e.g. "9:00 AM – 10:00 PM" or "Closed today"
function todayHoursLabel(hours: StoreHoursStatus): string {
  try {
    const now = new Date();
    // Get today's day-of-week in the store's timezone (0=Sun…6=Sat)
    const dowStr = now.toLocaleDateString("en-US", { timeZone: hours.timezone, weekday: "short" });
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[dowStr] ?? new Date().getDay();
    const row = hours.schedule.find((r) => r.day_of_week === dow);
    if (!row) return "Closed today";
    if (row.is_closed) return "Closed today";
    const open  = fmtTime(row.opens_at);
    const close = fmtTime(row.closes_at);
    if (!open && !close) return "Open all day";
    if (!open)  return `Until ${close}`;
    if (!close) return `From ${open}`;
    return `${open} – ${close}`;
  } catch {
    return "";
  }
}

// Timezone abbreviation label (e.g. "Asia/Kolkata" → "IST").
function tzAbbr(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

// Leaflet touches `window` at import time, so the map can only ever render
// client-side — ssr:false keeps Next.js from trying to render it on the server.
const LocationPicker = dynamic(() => import("@/components/LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center rounded-xl bg-gray-50 text-sm text-ink-faint">Loading map…</div>,
});

// No slot picker — every order is prepared ASAP, matching the app's
// "delivered in minutes" quick-commerce model. Still sent as delivery_slot
// since sellers/riders display it on their order cards.
const DELIVERY_SLOT = "Now (10–20 min)";

export default function CheckoutPage() {
  const supabase = createClient();
  const router = useRouter();
  const { items, subtotal, sellerId, clear } = useCart();

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [placing, setPlacing] = useState(false);
  const [showAddr, setShowAddr] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" });
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  // The address being edited, exactly as loaded — lets saveAddress detect
  // whether the buyer changed the written address text without re-pinning
  // (see saveAddress for why a stale pin is worse than no pin at all).
  const [editingOriginal, setEditingOriginal] = useState<Address | null>(null);
  // True once the buyer explicitly (re-)confirms a pin this session — as
  // opposed to `picked` just holding the address's old, never-touched
  // coordinates seeded by startEdit.
  const [pinTouched, setPinTouched] = useState(false);

  // Which address's inline map is open — "new" for the add-address form, an
  // address id for pinning/repinning an already-saved one, or null (closed).
  const [mapFor, setMapFor] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);

  // Client-side heads-up for the 10km delivery radius — the authoritative
  // check runs server-side in /api/orders regardless.
  const [sellerLoc, setSellerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  // Store hours — fetched once when the cart's seller is known.
  const [storeHours, setStoreHours] = useState<StoreHoursStatus | null>(null);

  const { settings } = useSettings();
  const deliveryFee = settings.delivery_fee;
  const otherCharges = settings.other_charges;
  const minOrder = settings.min_order_amount;

  const sub = subtotal();
  const belowMin = sub > 0 && sub < minOrder;
  const total = sub + deliveryFee + otherCharges;

  function applyPickedToForm(loc: PickedLocation) {
    setPicked(loc);
    // Prefer the pinned location's resolved address over whatever's already
    // typed — re-pinning means moving to a different spot, so the old value
    // shouldn't win just because a field was already filled in. Only fall
    // back to it if reverse-geocoding didn't resolve that particular field.
    setForm((f) => ({
      ...f,
      city: loc.city || f.city,
      state: loc.state || f.state,
      pincode: loc.pincode || f.pincode,
    }));
    setPinTouched(true);
    setMapFor(null);
  }

  async function confirmPinForExisting(addr: Address, loc: PickedLocation) {
    setPinning(true);
    try {
      const update = {
        lat: loc.lat,
        lng: loc.lng,
        city: loc.city || addr.city,
        state: loc.state || addr.state,
        pincode: loc.pincode || addr.pincode,
      };
      const { error } = await supabase.from("addresses").update(update).eq("id", addr.id);
      if (error) throw error;
      setAddresses((prev) => prev.map((a) => (a.id === addr.id ? { ...a, ...update } : a)));
      setMapFor(null);
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setPinning(false);
    }
  }

  useEffect(() => {
    // getSession() reads the cached session locally — no network round-trip,
    // unlike getUser(). The redirect below is a client-side UX convenience;
    // the actual order-creation authorization happens server-side in
    // /api/orders, which independently verifies the session.
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      const { data: addr } = await supabase
        .from("addresses")
        .select("*")
        .order("is_default", { ascending: false });
      const list = (addr as Address[]) ?? [];
      setAddresses(list);
      if (list[0]) setAddressId(list[0].id);
      else setShowAddr(true);
      setLoadingAddr(false);
    });
  }, [supabase, router]);

  // Fetch the seller's location + store hours once when cart seller is known.
  useEffect(() => {
    const sid = sellerId();
    if (!sid) return;
    // Run both fetches in parallel.
    Promise.all([
      fetch(`/api/sellers/${sid}/location`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/sellers/${sid}/hours`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([locJson, hoursJson]) => {
      if (locJson?.lat != null && locJson?.lng != null) {
        setSellerLoc({ lat: locJson.lat, lng: locJson.lng });
      }
      if (hoursJson) {
        setStoreHours(hoursJson as StoreHoursStatus);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute distance whenever the selected address (or its coordinates) changes.
  useEffect(() => {
    const addr = addresses.find((a) => a.id === addressId);
    if (sellerLoc && addr?.lat != null && addr?.lng != null) {
      setDistanceKm(haversineKm(sellerLoc, { lat: addr.lat, lng: addr.lng }));
    } else {
      setDistanceKm(null);
    }
  }, [addressId, addresses, sellerLoc]);

  const outOfRange = distanceKm !== null && distanceKm > MAX_DELIVERY_RADIUS_KM;
  // A buyer who typed their address without ever opening the map has no
  // lat/lng on the row — distanceKm stays null in that case, which used to
  // mean outOfRange silently evaluated false and let the order straight
  // through with the delivery radius never actually checked (server-side
  // had the same gap — see /api/orders). Only meaningful once we actually
  // know where the seller is; if the seller itself has no pinned location
  // there's nothing to compare against regardless of what the buyer did.
  const selectedAddr = addresses.find((a) => a.id === addressId);
  const needsPin = !!sellerLoc && !!selectedAddr && (selectedAddr.lat == null || selectedAddr.lng == null);
  // When storeHours is null (not yet fetched / no hours configured) we don't block.
  const storeClosed = storeHours !== null && storeHours.is_open === false;

  function resetAddressForm() {
    setShowAddr(false);
    setEditingId(null);
    setEditingOriginal(null);
    setPinTouched(false);
    setPicked(null);
    setMapFor(null);
    setForm({ line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" });
  }

  function startEdit(a: Address) {
    setEditingId(a.id);
    setEditingOriginal(a);
    setPinTouched(false);
    setForm({
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      pincode: a.pincode,
      label: a.label ?? "Home",
    });
    setPicked(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng, city: a.city, state: a.state, pincode: a.pincode } : null);
    setMapFor(null);
    setShowAddr(true);
  }

  async function deleteAddress(id: string) {
    if (!confirm("Remove this address?")) return;
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) return notify.error(error.message);
    const remaining = addresses.filter((a) => a.id !== id);
    setAddresses(remaining);
    if (addressId === id) setAddressId(remaining[0]?.id ?? "");
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (editingId) {
      // If the buyer changed the written address text without re-pinning,
      // `picked` is still just whatever startEdit seeded from the old row —
      // sending it back as-is would silently keep a rider's "Navigate"
      // pointed at the old location even though the text now reads
      // correctly. Drop the stale pin instead: with no lat/lng, the rider's
      // directionsHref() falls back to a text-based Maps search, which
      // resolves to the address as actually written.
      const textChanged =
        !!editingOriginal &&
        !pinTouched &&
        (form.line1 !== editingOriginal.line1 ||
          (form.line2 || "") !== (editingOriginal.line2 || "") ||
          (form.city || "") !== (editingOriginal.city || "") ||
          (form.state || "") !== (editingOriginal.state || "") ||
          form.pincode !== editingOriginal.pincode);

      const update = {
        ...form,
        lat: textChanged ? null : (picked?.lat ?? null),
        lng: textChanged ? null : (picked?.lng ?? null),
      };
      const { data, error } = await supabase.from("addresses").update(update).eq("id", editingId).select().single();
      if (error) return notify.error(error.message);
      const a = data as Address;
      setAddresses((prev) => prev.map((x) => (x.id === editingId ? a : x)));
      resetAddressForm();
      return;
    }
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        ...form,
        user_id: userId,
        is_default: addresses.length === 0,
        lat: picked?.lat ?? null,
        lng: picked?.lng ?? null,
      })
      .select()
      .single();
    if (error) return notify.error(error.message);
    const a = data as Address;
    setAddresses((p) => [...p, a]);
    setAddressId(a.id);
    resetAddressForm();
  }

  async function placeOrder() {
    if (!addressId) return notify.error("Please select a delivery address.");
    if (belowMin) return notify.error(`Order subtotal is below the minimum order of ${inr(minOrder)}.`);
    if (needsPin) return notify.error("Please pin your exact delivery location before placing this order.");
    if (outOfRange) return notify.error("This store doesn't deliver to your address.");
    if (storeClosed) return notify.error("This store is currently closed.");
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: sellerId(),
          address_id: addressId,
          delivery_slot: DELIVERY_SLOT,
          payment_method: "cod",
          items: items.map((i) => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty })),
        }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || "Failed to create order");

      clear();
      router.push(`/orders/${order.id}?placed=1`);
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-gray-500">
        Your cart is empty. <Link href="/" className="text-brand-700 underline">Shop now</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-extrabold">Checkout</h1>

      {/* Address */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Delivery address</h2>
          <button
            className="text-sm text-brand-700"
            onClick={() => (showAddr ? resetAddressForm() : setShowAddr(true))}
          >
            {showAddr ? "Cancel" : "+ Add new"}
          </button>
        </div>

        {loadingAddr && (
          <div className="mt-3 space-y-2">
            <SkelLine className="h-10 w-full rounded-lg" />
            <SkelLine className="h-10 w-full rounded-lg" />
          </div>
        )}

        {!loadingAddr && addresses.length > 0 && !showAddr && (
          <div className="mt-3 space-y-2">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-lg border p-2 text-sm">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="addr"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    className="mt-1"
                  />
                  <span className="flex-1">
                    <b>{a.label}</b> — {a.line1}, {a.line2 && `${a.line2}, `}
                    {a.city}{a.state && `, ${a.state}`} {a.pincode}
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => setMapFor(mapFor === a.id ? null : a.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline"
                      >
                        <MapPin className="h-3 w-3" />
                        {a.lat == null ? "Pin exact location" : "Adjust pin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(a)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAddress(a.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 underline"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </span>
                  </span>
                </label>
                {mapFor === a.id && (
                  <div className="mt-2">
                    <LocationPicker
                      initialLat={a.lat}
                      initialLng={a.lng}
                      onCancel={() => setMapFor(null)}
                      onConfirm={(loc) => confirmPinForExisting(a, loc)}
                    />
                    {pinning && <p className="mt-1 text-xs text-ink-faint">Saving…</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showAddr && (
          <form onSubmit={saveAddress} className="mt-3 grid grid-cols-2 gap-2">
            <input className="input col-span-2" placeholder="Address line 1" required
              value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
            <input className="input col-span-2" placeholder="Line 2 (optional)"
              value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
            <input className="input" placeholder="City"
              value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className="input" placeholder="State"
              value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <input className="input col-span-2" placeholder="Pincode" required
              value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />

            {mapFor === "new" ? (
              <div className="col-span-2">
                <LocationPicker
                  initialLat={picked?.lat}
                  initialLng={picked?.lng}
                  onCancel={() => setMapFor(null)}
                  onConfirm={applyPickedToForm}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMapFor("new")}
                className={`btn-outline col-span-2 ${picked ? "border-brand-500 text-brand-700" : ""}`}
              >
                <MapPin className="h-4 w-4" />
                {picked ? "Location pinned — tap to adjust" : "Pin exact location on map"}
              </button>
            )}
            <p className="col-span-2 -mt-1 text-[11px] text-ink-faint">
              Pinning your location helps the delivery partner reach your exact doorstep, and fills city/state/pincode automatically.
            </p>

            <button className="btn-primary col-span-2">{editingId ? "Update address" : "Save address"}</button>
          </form>
        )}
      </section>

      {needsPin && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This address hasn't been pinned on the map yet, so we can't confirm it's within
            delivery range. Edit the address and tap "Pin exact location" to continue.
          </span>
        </div>
      )}

      {outOfRange && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This store is about {distanceKm!.toFixed(1)} km from your address — we currently only
            deliver within {MAX_DELIVERY_RADIUS_KM} km. Choose a closer address to continue.
          </span>
        </div>
      )}

      {/* Store hours status */}
      {storeHours && (
        storeClosed ? (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">This store is currently closed</p>
              <p className="mt-0.5 text-red-600">
                {todayHoursLabel(storeHours)}
                {tzAbbr(storeHours.timezone) ? ` (${tzAbbr(storeHours.timezone)})` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="font-semibold">Open now</span>
            <span className="text-brand-500">·</span>
            <span className="text-brand-600">
              {todayHoursLabel(storeHours)}
              {tzAbbr(storeHours.timezone) ? ` (${tzAbbr(storeHours.timezone)})` : ""}
            </span>
          </div>
        )
      )}

      {/* Payment - COD only */}
      <section className="card p-4">
        <h2 className="font-bold">Payment</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg p-3">
            <span className="text-lg">💰</span>
            <span className="font-medium">Cash on Delivery only</span>
          </div>
          <p className="text-xs text-ink-faint">
            You will pay the delivery partner at the time of delivery (cash or UPI).
          </p>
        </div>
      </section>

      {/* Summary */}
      <section className="card space-y-2 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{inr(sub)}</span></div>
        <div className="flex justify-between"><span>Delivery fee</span><span>{inr(deliveryFee)}</span></div>
        <div className="flex justify-between"><span>Other charges</span><span>{inr(otherCharges)}</span></div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span><span>{inr(total)}</span>
        </div>
      </section>

      {belowMin && (
        <p className="rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-600">
          Add {inr(minOrder - sub)} more to reach the minimum order of {inr(minOrder)}.
        </p>
      )}

      <button className="btn-primary w-full" disabled={placing || needsPin || outOfRange || storeClosed || belowMin} onClick={placeOrder}>
        {placing ? "Placing order…" : `Place order · ${inr(total)}`}
      </button>
    </div>
  );
}
