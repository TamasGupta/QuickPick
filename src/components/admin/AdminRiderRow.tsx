"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Loader";

export function AdminRiderRow({ rider }: { rider: { id: string; full_name: string | null; phone: string | null } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Remove delivery partner access for ${rider.full_name ?? "this user"}?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/riders/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rider_id: rider.id }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className="text-sm font-medium">{rider.full_name ?? "Unnamed"}</p>
        <p className="text-xs text-gray-500">{rider.phone ? `+${rider.phone}` : "No phone"}</p>
      </div>
      <button className="btn-outline py-1 text-red-600" disabled={busy} onClick={remove}>
        {busy ? <Spinner className="h-4 w-4 border-red-200 border-t-red-600" /> : "Remove"}
      </button>
    </div>
  );
}
