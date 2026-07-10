"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/store/cart";
import { inr, DELIVERY_FEE } from "@/lib/utils";
import type { Address } from "@/lib/types";

const SLOTS = ["Now (10–20 min)", "Within 1 hour", "This evening", "Tomorrow morning"];

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

  const sub = subtotal();
  const total = sub + DELIVERY_FEE;

  // Capture the buyer's precise coordinates so the delivery partner can
  // navigate to the exact drop point.
  function detectLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("done");
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
    });
  }, [supabase, router]);

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
  }

  async function placeOrder() {
    setError(null);
    if (!addressId) return setError("Please select a delivery address.");
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

        {addresses.length > 0 && !showAddr && (
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
                <span>
                  <b>{a.label}</b> — {a.line1}, {a.line2 && `${a.line2}, `}
                  {a.city} {a.pincode}
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
            <button className="btn-primary col-span-2">Save address</button>
          </form>
        )}
      </section>

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

      <button className="btn-primary w-full" disabled={placing} onClick={placeOrder}>
        {placing ? "Placing order…" : pay === "cod" ? `Place order · ${inr(total)}` : `Pay ${inr(total)}`}
      </button>
    </div>
  );
}
