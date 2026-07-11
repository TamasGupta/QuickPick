"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Zap, MapPin, Search, ShoppingCart, ChevronDown, User } from "lucide-react";
import { useCart } from "@/store/cart";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const rawCount = useCart((s) => s.count());
  const router = useRouter();
  const params = useSearchParams();
  const [phone, setPhone] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();
  // Cart count comes from a persisted store that rehydrates on the client;
  // gate it behind `mounted` so SSR and first client render match.
  const count = mounted ? rawCount : 0;

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      setLoggedIn(!!data.user);
      setPhone(data.user?.phone ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user);
      setPhone(session?.user?.phone ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-md">
      <div className="container-app flex h-16 items-center gap-3 sm:gap-6">
        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center gap-1.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Zap className="h-5 w-5 fill-white" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-ink">QuickPick</span>
        </Link>

        {/* Delivery + location (desktop) */}
        <div className="hidden shrink-0 flex-col leading-tight sm:flex">
          <span className="text-[13px] font-extrabold text-ink">Delivery in 11 minutes</span>
          <button className="flex items-center gap-1 text-xs text-ink-soft">
            <MapPin className="h-3 w-3" />
            <span className="max-w-[180px] truncate">Home · Bengaluru 560001</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Search (desktop) */}
        <form onSubmit={submitSearch} className="relative hidden flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search "milk", "bread", "atta"…'
            className="input pl-10"
          />
        </form>

        {/* Actions */}
        <nav className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <Link href="/rider" className="btn-ghost hidden lg:inline-flex">
            Deliver
          </Link>
          <Link href="/seller" className="btn-ghost hidden lg:inline-flex">
            Sell
          </Link>
          {mounted && loggedIn ? (
            <Link
              href="/account"
              className="btn-ghost hidden sm:inline-flex"
              title={phone ? `+${phone}` : undefined}
            >
              <User className="h-5 w-5" />
              <span className="hidden md:inline">Account</span>
            </Link>
          ) : (
            <Link href="/login" className="btn-outline hidden sm:inline-flex">
              Login
            </Link>
          )}
          <Link
            href="/cart"
            className="relative inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">{count > 0 ? `${count} item${count > 1 ? "s" : ""}` : "Cart"}</span>
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-400 px-1 text-[11px] font-extrabold text-ink sm:hidden">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Search (mobile) */}
      <div className="container-app pb-3 sm:hidden">
        <form onSubmit={submitSearch} className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search "milk", "bread", "atta"…'
            className="input pl-10"
          />
        </form>
      </div>
    </header>
  );
}
