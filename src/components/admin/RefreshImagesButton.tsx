"use client";

import { useState } from "react";
import { RefreshCw, ImageOff } from "lucide-react";
import { Spinner } from "@/components/Loader";
import { notify } from "@/store/notify";

export function RefreshImagesButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/products/refresh-images", { method: "POST" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      notify.error(json.error ?? "Something went wrong");
      return;
    }
    setResult(
      `Checked ${json.checked} · filled ${json.filled} · fixed ${json.fixed} · cleared ${json.cleared}` +
        (json.remaining ? " · more pending, run again" : "")
    );
  }

  return (
    <div className="card space-y-2 p-4">
      <h3 className="flex items-center gap-1.5 font-bold text-ink">
        <ImageOff className="h-4 w-4 text-accent-600" /> Auto-fetched product images
      </h3>
      <p className="text-xs text-ink-faint">
        Fetches photos for products with no image yet, and re-checks previously auto-fetched images
        for broken links. Seller-uploaded images are never touched. Runs in small batches — click
        again if it says more are pending.
      </p>
      {result && <p className="text-sm text-brand-700">{result}</p>}
      <button className="btn-outline" onClick={run} disabled={loading}>
        {loading ? <Spinner className="h-4 w-4 border-brand-200 border-t-brand-600" /> : <RefreshCw className="h-4 w-4" />}
        Refresh product images
      </button>
    </div>
  );
}
