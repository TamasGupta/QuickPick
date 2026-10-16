"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, ShoppingCart, ChevronDown, User } from "lucide-react";
import { useCart } from "@/store/cart";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";
import { ProductSearchBar } from "@/components/ProductSearchBar";
import type { Address } from "@/lib/types";

export function Header() {
  const rawCount = useCart((s) => s.count());
  const pathname = usePathname();
  // Seller/admin/rider consoles don't shop — same route check BottomNav uses.
  const inConsole = pathname.startsWith("/seller") || pathname.startsWith("/admin") || pathname.startsWith("/rider");
  const inSellerConsole = pathname.startsWith("/seller");
  const inRiderConsole = pathname.startsWith("/rider");
  const inAdminOrRiderConsole = pathname.startsWith("/admin") || inRiderConsole;
  // Neither console has anything to search — sellers/riders manage their own
  // orders/products/deliveries, not the buyer catalog.
  const hideSearch = inConsole;
  // Login has no shopping context — search, delivery location, and the
  // cart/login actions are all irrelevant (and "Login" is actively
  // confusing) while you're already on the login screen.
  const onLoginPage = pathname.startsWith("/login");
  const [email, setEmail] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [sellerAddr, setSellerAddr] = useState<{ city: string | null; pincode: string | null; lat: number | null } | null>(null);
  const supabase = createClient();
  // Cart count comes from a persisted store that rehydrates on the client;
  // gate it behind `mounted` so SSR and first client render match.
  const count = mounted ? rawCount : 0;

  useEffect(() => {
    setMounted(true);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user);
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Re-check the session on every client-side navigation, not just on mount.
  // Logins that go through our static-OTP route (src/app/api/auth/static-login)
  // set the session via a server response setting cookies directly, so they
  // never fire supabase.auth.onAuthStateChange on this client SDK instance —
  // without this, the header stays stuck showing "Login" until a manual
  // page refresh remounts it.
  //
  // getSession() reads the already-cached session from local storage —
  // unlike getUser(), it never makes a network round-trip to revalidate the
  // JWT server-side. That server revalidation matters for a security
  // decision (a server-side API route deciding what to authorize), but this
  // is just client-side UI state (is someone logged in, what's their id to
  // scope further queries) feeding queries that are themselves RLS-protected
  // regardless — getUser() here was three redundant network calls (this
  // effect plus the two below) on every seller-console page load for no
  // extra safety.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session?.user);
      setEmail(data.session?.user?.email ?? null);
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
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      setFullName(profile?.full_name ?? null);
    });
  }, [supabase, loggedIn]);

  // Seller's own store location — separate from the buyer delivery-address
  // fetch above, and re-run on every seller-console navigation (not just
  // login) so it picks up an edit made on /seller/settings the moment you
  // navigate to another seller page.
  useEffect(() => {
    if (!loggedIn || !inSellerConsole) {
      setSellerAddr(null);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const { data: seller } = await supabase
        .from("sellers")
        .select("city, pincode, lat")
        .eq("owner_id", user.id)
        .maybeSingle();
      setSellerAddr(seller ?? null);
    });
  }, [supabase, loggedIn, inSellerConsole, pathname]);


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

        {!onLoginPage && (
          <>
            {/* Delivery/store location (desktop) — buyer-facing pages show
                the "Delivery in 11 minutes" delivery address; the seller
                console shows their own store location instead; admin/rider
                consoles have no location concept here at all, so nothing
                renders for them. */}
            {inSellerConsole ? (
              <div className="hidden shrink-0 flex-col leading-tight sm:flex">
                <span className="text-[13px] font-extrabold text-ink">Store location</span>
                {mounted && sellerAddr?.lat != null ? (
                  <span className="flex items-center gap-1 text-xs text-ink-soft">
                    <MapPin className="h-3 w-3" />
                    <span className="max-w-[180px] truncate">
                      {[sellerAddr.city, sellerAddr.pincode].filter(Boolean).join(" ") || "Pinned"}
                    </span>
                  </span>
                ) : (
                  <Link href="/seller/settings" className="flex items-center gap-1 text-xs text-ink-soft">
                    <MapPin className="h-3 w-3" />
                    <span>Set store location</span>
                    <ChevronDown className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ) : !inAdminOrRiderConsole ? (
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
            ) : null}

            {/* Search (desktop) — sellers/riders have nothing to search here. */}
            {!hideSearch && (
              <ProductSearchBar id="desktop-search-input" className="hidden flex-1 sm:block max-w-md lg:max-w-lg" />
            )}
          </>
        )}

        {/* Actions */}
        {!onLoginPage && (
          <nav className="ml-auto flex items-center gap-1.5 sm:gap-3">
            {mounted && loggedIn ? (
              <Link
                href="/account"
                className="btn-ghost hidden sm:inline-flex"
                title={email ?? undefined}
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
        )}
      </div>

      {/* Search (mobile) — sellers/riders have nothing to search here. */}
      {!onLoginPage && !hideSearch && (
        <div className="container-app pb-3 sm:hidden">
          <ProductSearchBar id="mobile-search-input" className="w-full" />
        </div>
      )}
    </header>
  );
}
