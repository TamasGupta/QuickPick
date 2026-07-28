"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/seller", label: "Dashboard" },
  { href: "/seller/upload", label: "Bulk Upload" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/ledger", label: "Ledger" },
  { href: "/seller/settings", label: "Settings" },
];

// New-orders badge for the Orders tab. Realtime-driven, not polled: this
// used to go through /api/notifications on a 20s timer regardless of
// whether anything changed. RLS already lets a seller read their own
// orders directly (orders_read policy), so this resolves the seller id
// client-side once and subscribes straight to postgres_changes.
function useSellerNewCount(): number {
  const [sellerNew, setSellerNew] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refreshCount(sellerId: string) {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("status", "placed")
        .neq("payment_status", "pending");
      if (alive) setSellerNew(count ?? 0);
    }

    // getSession() reads the cached session locally — no network round-trip,
    // unlike getUser(). Same reasoning as BottomNav's useBuyerActiveCount:
    // this is UI state feeding an RLS-scoped query, not a security decision.
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user || !alive) return;
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!seller?.id || !alive) return;

      refreshCount(seller.id);
      channel = supabase
        .channel(`seller-new-orders-${seller.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${seller.id}` },
          () => refreshCount(seller.id)
        )
        .subscribe();
    });

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return sellerNew;
}

export function SellerNav() {
  const path = usePathname();
  const sellerNew = useSellerNewCount();
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
