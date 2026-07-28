"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LayoutGrid, ShoppingCart, ClipboardList, User } from "lucide-react";
import { useCart } from "@/store/cart";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/categories", label: "Categories", icon: LayoutGrid, match: (p: string) => p.startsWith("/categories") },
  { href: "/cart", label: "Cart", icon: ShoppingCart, match: (p: string) => p.startsWith("/cart") },
  { href: "/orders", label: "Orders", icon: ClipboardList, match: (p: string) => p.startsWith("/orders") },
  { href: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") },
];

// Active-orders count for the Orders tab badge. Realtime-driven, not polled,
// and isolated in its own component so the subscription only ever mounts for
// the buyer-facing shell — BottomNav itself lives in the root layout and
// renders on every route, including seller/admin/rider consoles where this
// badge doesn't apply, so this must not run as part of that always-mounted
// component. Scoped to buyer_id = auth.uid(), same RLS-direct pattern as
// BuyerOrdersList.
function useBuyerActiveCount(): number {
  const [buyerActive, setBuyerActive] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refreshCount() {
      if (!userId) return;
      const { count: c } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", userId)
        .not("status", "in", "(delivered,cancelled)");
      if (alive) setBuyerActive(c ?? 0);
    }

    // getSession() reads the cached session locally — no network round-trip,
    // unlike getUser(). This is just client-side UI state feeding an
    // RLS-scoped query, not a security decision, so there's nothing to gain
    // from the server revalidation getUser() would add here.
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user || !alive) return;
      userId = user.id;
      refreshCount();
      channel = supabase
        .channel(`buyer-active-count-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${userId}` },
          refreshCount
        )
        .subscribe();
    });

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return buyerActive;
}

function BuyerNav({ path }: { path: string }) {
  const rawCount = useCart((s) => s.count());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? rawCount : 0;
  const buyerActive = useBuyerActiveCount();

  const badgeFor = (href: string) =>
    href === "/cart" ? count : href === "/orders" && mounted ? buyerActive : 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur-md shadow-nav sm:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cx(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-brand-700" : "text-ink-faint"
                )}
              >
                <span className="relative">
                  <Icon className={cx("h-[22px] w-[22px]", active && "stroke-[2.4]")} />
                  {badgeFor(href) > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-extrabold text-white">
                      {badgeFor(href)}
                    </span>
                  )}
                </span>
                {label}
                {active && <span className="absolute -top-px h-0.5 w-8 rounded-full bg-brand-600" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  const inConsole = path.startsWith("/seller") || path.startsWith("/admin") || path.startsWith("/rider");
  // Hide inside seller/admin/rider consoles — and never mount BuyerNav (and
  // its Realtime subscription) there in the first place.
  if (inConsole) return null;
  return <BuyerNav path={path} />;
}
