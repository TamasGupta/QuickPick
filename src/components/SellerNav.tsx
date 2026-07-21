"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

const LINKS = [
  { href: "/seller", label: "Dashboard" },
  { href: "/seller/upload", label: "Bulk Upload" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/settings", label: "Settings" },
];

export function SellerNav() {
  const path = usePathname();
  const { sellerNew } = useNotifications();
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b">
      {LINKS.map((l) => {
        const active = path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {l.label}
            {l.href === "/seller/orders" && sellerNew > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
                {sellerNew}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
