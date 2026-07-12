"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Loader";
import type { SellerStatus } from "@/lib/types";

export function AdminSellerRow({
  seller,
}: {
  seller: { id: string; store_name: string; city: string | null; status: SellerStatus };
}) {
  const supabase = createClient();
  const [status, setStatus] = useState<SellerStatus>(seller.status);
  const [busy, setBusy] = useState(false);

  async function set(next: SellerStatus) {
    setBusy(true);
    const { error } = await supabase.from("sellers").update({ status: next }).eq("id", seller.id);
    if (!error) setStatus(next);
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className="text-sm font-medium">{seller.store_name}</p>
        <p className="text-xs text-gray-500">{seller.city}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`badge ${
            status === "approved"
              ? "bg-brand-50 text-brand-700"
              : status === "pending"
              ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {status}
        </span>
        {status !== "approved" && (
          <button className="btn-primary py-1" disabled={busy} onClick={() => set("approved")}>
            {busy ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : "Approve"}
          </button>
        )}
        {status !== "suspended" && (
          <button className="btn-outline py-1 text-red-600" disabled={busy} onClick={() => set("suspended")}>
            {busy ? <Spinner className="h-4 w-4 border-red-200 border-t-red-600" /> : "Suspend"}
          </button>
        )}
      </div>
    </div>
  );
}
