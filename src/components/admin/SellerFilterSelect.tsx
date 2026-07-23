"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function SellerFilterSelect({ sellers }: { sellers: { id: string; store_name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("seller") ?? "";

  return (
    <select
      className="input w-auto"
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        router.push(value ? `${pathname}?seller=${value}` : pathname);
      }}
    >
      <option value="">All sellers</option>
      {sellers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.store_name}
        </option>
      ))}
    </select>
  );
}
