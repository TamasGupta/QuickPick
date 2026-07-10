"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/seller", label: "Dashboard" },
  { href: "/seller/upload", label: "Bulk Upload" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/orders", label: "Orders" },
];

export function SellerNav() {
  const path = usePathname();
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b">
      {LINKS.map((l) => {
        const active = path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
