"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, TriangleAlert, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/store/cart";
import { inr, DELIVERY_FEE, OTHER_CHARGES } from "@/lib/utils";
import { haversineKm, MAX_DELIVERY_RADIUS_KM } from "@/lib/geo";
import { SkelLine } from "@/components/skeletons";
import { notify } from "@/store/notify";
import type { Address } from "@/lib/types";
import type { PickedLocation } from "@/components/LocationPicker";

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

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function CheckoutPage() {
  const supabase = createClient();
  const router = useRouter();
  const { items, subtotal, sellerId, clear } = useCart();

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [pay, setPay] = useState<"online" | "cod">("online");
  const [placing, setPlacing] = useState(false);
  const [showAddr, setShowAddr] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" });
  const [picked, setPicked] = useState<PickedLocation | null>(null);

  // Which address's inline map is open — "new" for the add-address form, an
  // address id for pinning/repinning an already-saved one, or null (closed).
  const [mapFor, setMapFor] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);

  // Client-side heads-up for the 10km delivery radius — the authoritative
  // check runs server-side in /api/orders regardless.
  const [sellerLoc, setSellerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const sub = subtotal();
  const total = sub + DELIVERY_FEE + OTHER_CHARGES;

  function applyPickedToForm(loc: PickedLocation) {
    setPicked(loc);
    setForm((f) => ({
      ...f,
      city: f.city || loc.city || "",
      state: f.state || loc.state || "",
      pincode: f.pincode || loc.pincode || "",
    }));
    setMapFor(null);
  }

  async function confirmPinForExisting(addr: Address, loc: PickedLocation) {
    setPinning(true);
    try {
      const update = {
        lat: loc.lat,
        lng: loc.lng,
        city: addr.city || loc.city || addr.city,
        state: addr.state || loc.state || addr.state,
        pincode: addr.pincode || loc.pincode || addr.pincode,
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

  function resetAddressForm() {
    setShowAddr(false);
    setEditingId(null);
    setPicked(null);
    setMapFor(null);
    setForm({ line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" });
  }

  function startEdit(a: Address) {
    setEditingId(a.id);
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
      const update = {
        ...form,
        lat: picked?.lat ?? null,
        lng: picked?.lng ?? null,
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
    if (outOfRange) return notify.error("This store doesn't deliver to your address.");
    setPlacing(true);
    try {
      // 1) Create the order server-side.
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: sellerId(),
          address_id: addressId,
          delivery_slot: DELIVERY_SLOT,
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

      // The order row already exists at this point (status: 'placed',
      // payment_status: 'pending') so Razorpay has something to reference —
      // but if the payment never actually succeeds, that row must not be
      // left behind looking like a real order. `paymentSucceeded` guards
      // against a race where the modal's dismiss event fires around the same
      // time as a genuine success: once Razorpay's own handler has fired at
      // all, we never cancel, regardless of what happens next.
      let paymentSucceeded = false;

      async function cancelUnpaidOrder() {
        // Scoped to payment_status='pending' so this can never touch an
        // order a concurrent verify() call just marked paid.
        await supabase
          .from("orders")
          .update({ status: "cancelled", payment_status: "failed" })
          .eq("id", order.id)
          .eq("payment_status", "pending");
      }

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: rp.amount,
        currency: "INR",
        name: "GrabOn",
        description: `Order ${order.id.slice(0, 8)}`,
        order_id: rp.razorpay_order_id,
        handler: async (resp: any) => {
          paymentSucceeded = true;
          const v = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.id, ...resp }),
          });
          if (v.ok) {
            clear();
            router.push(`/orders/${order.id}?placed=1`);
          } else {
            notify.error("Payment verification failed. Please contact support.");
          }
        },
        modal: {
          ondismiss: () => {
            if (!paymentSucceeded) cancelUnpaidOrder();
          },
        },
        theme: { color: "#12924f" },
      });
      rzp.on("payment.failed", () => {
        if (paymentSucceeded) return;
        cancelUnpaidOrder();
        notify.error("Payment failed — your order was not placed. Please try again.");
      });
      rzp.open();
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

      {outOfRange && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This store is about {distanceKm!.toFixed(1)} km from your address — we currently only
            deliver within {MAX_DELIVERY_RADIUS_KM} km. Choose a closer address to continue.
          </span>
        </div>
      )}

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
        <div className="flex justify-between"><span>Other charges</span><span>{inr(OTHER_CHARGES)}</span></div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span><span>{inr(total)}</span>
        </div>
      </section>

      <button className="btn-primary w-full" disabled={placing || outOfRange} onClick={placeOrder}>
        {placing ? "Placing order…" : pay === "cod" ? `Place order · ${inr(total)}` : `Pay ${inr(total)}`}
      </button>
    </div>
  );
}
