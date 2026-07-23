"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Date-range + Prev/Next pagination controls, all driven by URL search
// params (from/to/page) so filtered/paginated views are shareable links and
// survive a refresh. Any other existing params (e.g. admin ledger's
// `seller`) are preserved untouched.
export function HistoryFilters({ hasMore, page }: { hasMore: boolean; page: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function push(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    router.push(`${pathname}?${next.toString()}`);
  }

  function setDate(key: "from" | "to", value: string) {
    push((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
    });
  }

  function clearDates() {
    push((next) => {
      next.delete("from");
      next.delete("to");
      next.delete("page");
    });
  }

  function goPage(delta: number) {
    push((next) => next.set("page", String(Math.max(1, page + delta))));
  }

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        From
        <input
          type="date"
          className="input w-auto py-1.5 text-xs"
          value={from}
          max={to || undefined}
          onChange={(e) => setDate("from", e.target.value)}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-ink-faint">
        To
        <input
          type="date"
          className="input w-auto py-1.5 text-xs"
          value={to}
          min={from || undefined}
          onChange={(e) => setDate("to", e.target.value)}
        />
      </label>
      {(from || to) && (
        <button className="btn-ghost py-1 text-xs" onClick={clearDates}>
          Clear
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button className="btn-outline py-1 text-xs" disabled={page <= 1} onClick={() => goPage(-1)}>
          Prev
        </button>
        <span className="text-xs text-ink-faint">Page {page}</span>
        <button className="btn-outline py-1 text-xs" disabled={!hasMore} onClick={() => goPage(1)}>
          Next
        </button>
      </div>
    </div>
  );
}
