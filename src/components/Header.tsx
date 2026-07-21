"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Search, ShoppingCart, ChevronDown, User } from "lucide-react";
import { useCart } from "@/store/cart";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";
import type { Address } from "@/lib/types";

export function Header() {
  const rawCount = useCart((s) => s.count());
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Seller/admin/rider consoles don't shop — same route check BottomNav uses.
  const inConsole = pathname.startsWith("/seller") || pathname.startsWith("/admin") || pathname.startsWith("/rider");
  const [phone, setPhone] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mounted, setMounted] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const supabase = createClient();
  // Cart count comes from a persisted store that rehydrates on the client;
  // gate it behind `mounted` so SSR and first client render match.
  const count = mounted ? rawCount : 0;

  useEffect(() => {
    setMounted(true);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user);
      setPhone(session?.user?.phone ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Re-check the session on every client-side navigation, not just on mount.
  // Logins that go through our static-OTP route (src/app/api/auth/static-login)
  // set the session via a server response setting cookies directly, so they
  // never fire supabase.auth.onAuthStateChange on this client SDK instance —
  // without this, the header stays stuck showing "Login" until a manual
  // page refresh remounts it.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setLoggedIn(!!data.user);
      setPhone(data.user?.phone ?? null);
    });
  }, [supabase, pathname]);

  useEffect(() => {
    if (!loggedIn) {
      setDefaultAddress(null);
      setFullName(null);
      return;
    }
    supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .limit(1)
      .then(({ data }) => setDefaultAddress((data?.[0] as Address) ?? null));
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .single();
      setFullName(profile?.full_name ?? null);
    });
  }, [supabase, loggedIn]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-md">
      <div className="container-app flex h-16 items-center gap-3 sm:gap-6">
        {/* Brand — plain (non-navigating) inside seller/admin/rider consoles,
            since clicking through to the buyer listing page there is unwanted. */}
        {inConsole ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-sm">
              <LogoMark className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-ink">GrabOn</span>
          </span>
        ) : (
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-sm">
              <LogoMark className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-ink">GrabOn</span>
          </Link>
        )}

        {/* Delivery + location (desktop) */}
        <div className="hidden shrink-0 flex-col leading-tight sm:flex">
          <span className="text-[13px] font-extrabold text-ink">Delivery in 11 minutes</span>
          {mounted && loggedIn && defaultAddress ? (
            <span className="flex items-center gap-1 text-xs text-ink-soft">
              <MapPin className="h-3 w-3" />
              <span className="max-w-[180px] truncate">
                {defaultAddress.label} · {defaultAddress.city ?? ""} {defaultAddress.pincode}
              </span>
            </span>
          ) : (
            <Link href="/checkout" className="flex items-center gap-1 text-xs text-ink-soft">
              <MapPin className="h-3 w-3" />
              <span>Set delivery location</span>
              <ChevronDown className="h-3 w-3" />
            </Link>
          )}
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
          {mounted && loggedIn ? (
            <Link
              href="/account"
              className="btn-ghost hidden sm:inline-flex"
              title={phone ? `+${phone}` : undefined}
            >
              <User className="h-5 w-5" />
              <span className="hidden max-w-[140px] truncate md:inline">{fullName || "Account"}</span>
            </Link>
          ) : (
            <Link href="/login" className="btn-outline hidden sm:inline-flex">
              Login
            </Link>
          )}
          {!inConsole && (
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
          )}
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
