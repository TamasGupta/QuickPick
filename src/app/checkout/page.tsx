"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/store/cart";
import { inr, DELIVERY_FEE } from "@/lib/utils";
import { haversineKm, MAX_DELIVERY_RADIUS_KM } from "@/lib/geo";
import { SkelLine } from "@/components/skeletons";
import type { Address } from "@/lib/types";

const SLOTS = ["Now (10–20 min)", "Within 1 hour", "This evening", "Tomorrow morning"];

declare global {
  interface Window {
    Razorpay?: any;
  }
}

// Wraps navigator.geolocation with consistent, logged error handling so a
// failure is actually diagnosable (previously errors were swallowed with no
// detail anywhere — the #1 reported cause of "location isn't working").
function getBrowserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation isn't supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.error("Geolocation failed:", err.code, err.message);
        const messages: Record<number, string> = {
          1: "Location permission was denied. Enable it in your browser/site settings.",
          2: "Your device couldn't determine a location right now.",
          3: "Location request timed out — try again.",
        };
        reject(new Error(messages[err.code] ?? err.message));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export default function CheckoutPage() {
  const supabase = createClient();
  const router = useRouter();
  const { items, subtotal, sellerId, clear } = useCart();

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [slot, setSlot] = useState(SLOTS[0]);
  const [pay, setPay] = useState<"online" | "cod">("online");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddr, setShowAddr] = useState(false);
  const [form, setForm] = useState({ line1: "", line2: "", city: "", pincode: "", label: "Home" });
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "done" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  // Pinning location on an already-saved address (previously impossible).
  const [pinningId, setPinningId] = useState<string | null>(null);

  // Client-side heads-up for the 10km delivery radius — the authoritative
  // check runs server-side in /api/orders regardless.
  const [sellerLoc, setSellerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const sub = subtotal();
  const total = sub + DELIVERY_FEE;

  async function detectLocation() {
    setGeoStatus("locating");
    setGeoError(null);
    try {
      const pos = await getBrowserLocation();
      setGeo(pos);
      setGeoStatus("done");
    } catch (err) {
      setGeoStatus("error");
      setGeoError((err as Error).message);
    }
  }

  async function pinExistingAddress(addr: Address) {
    setPinningId(addr.id);
    try {
      const pos = await getBrowserLocation();
      const { error } = await supabase
        .from("addresses")
        .update({ lat: pos.lat, lng: pos.lng })
        .eq("id", addr.id);
      if (error) throw error;
      setAddresses((prev) => prev.map((a) => (a.id === addr.id ? { ...a, ...pos } : a)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPinningId(null);
    }
  }

  useEffect(() => {
    // Load Razorpay checkout script once.
    if (!document.getElementById("rzp-sdk")) {
      const s = document.createElement("script");
      s.id = "rzp-sdk";
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.body.appendChild(s);
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
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

  // Fetch the seller's store location once, for the client-side distance check.
  useEffect(() => {
    const sid = sellerId();
    if (!sid) return;
    fetch(`/api/sellers/${sid}/location`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.lat != null && json?.lng != null) {
          setSellerLoc({ lat: json.lat, lng: json.lng });
        }
      })
      .catch(() => {});
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

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        ...form,
        user_id: userId,
        is_default: addresses.length === 0,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
      })
      .select()
      .single();
    if (error) return setError(error.message);
    const a = data as Address;
    setAddresses((p) => [...p, a]);
    setAddressId(a.id);
    setShowAddr(false);
    setGeo(null);
    setGeoStatus("idle");
    setGeoError(null);
  }

  async function placeOrder() {
    setError(null);
    if (!addressId) return setError("Please select a delivery address.");
    if (outOfRange) return setError("This store doesn't deliver to your address.");
    setPlacing(true);
    try {
      // 1) Create the order server-side.
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: sellerId(),
          address_id: addressId,
          delivery_slot: slot,
          payment_method: pay,
          items: items.map((i) => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty })),
        }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || "Failed to create order");

      if (pay === "cod") {
        clear();
        router.push(`/orders/${order.id}?placed=1`);
        return;
      }

      // 2) Create Razorpay order and open checkout.
      const payRes = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      const rp = await payRes.json();
      if (!payRes.ok) throw new Error(rp.error || "Payment init failed");

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: rp.amount,
        currency: "INR",
        name: "QuickPick",
        description: `Order ${order.id.slice(0, 8)}`,
        order_id: rp.razorpay_order_id,
        handler: async (resp: any) => {
          const v = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.id, ...resp }),
          });
          if (v.ok) {
            clear();
            router.push(`/orders/${order.id}?placed=1`);
          } else {
            setError("Payment verification failed. Please contact support.");
          }
        },
        theme: { color: "#12924f" },
      });
      rzp.open();
    } catch (err) {
      setError((err as Error).message);
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
          <button className="text-sm text-brand-700" onClick={() => setShowAddr(!showAddr)}>
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
              <label key={a.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm">
                <input
                  type="radio"
                  name="addr"
                  checked={addressId === a.id}
                  onChange={() => setAddressId(a.id)}
                  className="mt-1"
                />
                <span className="flex-1">
                  <b>{a.label}</b> — {a.line1}, {a.line2 && `${a.line2}, `}
                  {a.city} {a.pincode}
                  {a.lat == null && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        pinExistingAddress(a);
                      }}
                      disabled={pinningId === a.id}
                      className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline"
                    >
                      <MapPin className="h-3 w-3" />
                      {pinningId === a.id ? "Locating…" : "Pin exact location"}
                    </button>
                  )}
                </span>
              </label>
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
            <input className="input" placeholder="Pincode" required
              value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />

            <div className="col-span-2 flex items-center gap-2">
              <button
                type="button"
                onClick={detectLocation}
                className={`btn-outline ${geoStatus === "done" ? "border-brand-500 text-brand-700" : ""}`}
              >
                <MapPin className="h-4 w-4" />
                {geoStatus === "locating"
                  ? "Locating…"
                  : geoStatus === "done"
                    ? "Location pinned"
                    : "Use current location"}
              </button>
              {geoStatus === "done" && geo && (
                <span className="text-xs text-brand-700">
                  📍 {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                </span>
              )}
              {geoStatus === "error" && (
                <span className="text-xs text-red-500">{geoError ?? "Couldn't get location — you can still save."}</span>
              )}
            </div>
            <p className="col-span-2 -mt-1 text-[11px] text-ink-faint">
              Pinning your location helps the delivery partner reach your exact doorstep.
            </p>

            <button className="btn-primary col-span-2">Save address</button>
          </form>
        )}
      </section>

      {outOfRange && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This store is about {distanceKm!.toFixed(1)} km from your address — we currently only
            deliver within {MAX_DELIVERY_RADIUS_KM} km. Choose a closer address to continue.
          </span>
        </div>
      )}

      {/* Slot */}
      <section className="card p-4">
        <h2 className="font-bold">Delivery slot</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SLOTS.map((s) => (
            <button
              key={s}
              onClick={() => setSlot(s)}
              className={`badge border px-3 py-1.5 ${
                slot === s ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Payment */}
      <section className="card p-4">
        <h2 className="font-bold">Payment</h2>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={pay === "online"} onChange={() => setPay("online")} />
            Pay online (UPI / Card / Wallet) via Razorpay
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={pay === "cod"} onChange={() => setPay("cod")} />
            Cash on Delivery
          </label>
        </div>
      </section>

      {/* Summary */}
      <section className="card space-y-2 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{inr(sub)}</span></div>
        <div className="flex justify-between"><span>Delivery fee</span><span>{inr(DELIVERY_FEE)}</span></div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span><span>{inr(total)}</span>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <button className="btn-primary w-full" disabled={placing || outOfRange} onClick={placeOrder}>
        {placing ? "Placing order…" : pay === "cod" ? `Place order · ${inr(total)}` : `Pay ${inr(total)}`}
      </button>
    </div>
  );
}
