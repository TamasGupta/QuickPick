"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LayoutGrid, ShoppingCart, ClipboardList, User } from "lucide-react";
import { useCart } from "@/store/cart";
import { useNotifications } from "@/hooks/useNotifications";
import { cx } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/categories", label: "Categories", icon: LayoutGrid, match: (p: string) => p.startsWith("/categories") },
  { href: "/cart", label: "Cart", icon: ShoppingCart, match: (p: string) => p.startsWith("/cart") },
  { href: "/orders", label: "Orders", icon: ClipboardList, match: (p: string) => p.startsWith("/orders") },
  { href: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") },
];

export function BottomNav() {
  const path = usePathname();
  const rawCount = useCart((s) => s.count());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? rawCount : 0;
  const { buyerActive } = useNotifications();

  // Hide inside seller/admin/rider consoles.
  if (path.startsWith("/seller") || path.startsWith("/admin") || path.startsWith("/rider"))
    return null;

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
