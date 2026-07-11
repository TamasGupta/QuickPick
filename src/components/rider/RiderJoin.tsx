"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Zap, MapPin, Wallet } from "lucide-react";
import { Spinner } from "@/components/Loader";

export function RiderJoin({ name }: { name: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/rider/join", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 p-7 text-white shadow-pop">
        <Bike className="absolute -right-4 -top-2 h-28 w-28 opacity-20" />
        <h1 className="text-2xl font-extrabold">Become a delivery partner</h1>
        <p className="mt-2 text-sm text-white/85">
          {name ? `Hey ${name}! ` : ""}Deliver orders near you and earn on every trip.
        </p>
      </div>

      <div className="grid gap-3">
        {[
          { icon: Wallet, title: "Earn per delivery", sub: "Get paid for every completed order" },
          { icon: Zap, title: "Flexible hours", sub: "Go online whenever you want" },
          { icon: MapPin, title: "Nearby orders", sub: "Pick jobs from stores around you" },
        ].map((f) => (
          <div key={f.title} className="card flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <f.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{f.title}</p>
              <p className="text-xs text-ink-faint">{f.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <button onClick={join} disabled={loading} className="btn-primary w-full py-3.5 text-base">
        {loading ? <Spinner /> : <Bike className="h-5 w-5" />}
        {loading ? "Setting up…" : "Start delivering"}
      </button>
    </div>
  );
}
