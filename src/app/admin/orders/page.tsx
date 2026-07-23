import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { HistoryFilters } from "@/components/HistoryFilters";
import { formatIST, ORDER_STATUS_LABELS, istDayBounds, HISTORY_PAGE_SIZE } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface StatusEvent {
  status: OrderStatus;
  created_at: string;
}

interface OrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  sellers: { store_name: string } | null;
}

// Human-readable duration between two ISO timestamps, e.g. "2h 14m" or "48s".
function durationLabel(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default async function AdminOrderLifecyclePage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; page?: string };
}) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-gray-500">
        <p className="text-4xl">🔒</p>
        <p className="mt-2 font-semibold">Admins only</p>
      </div>
    );
  }

  const page = Math.max(1, Number(searchParams.page) || 1);
  const offset = (page - 1) * HISTORY_PAGE_SIZE;

  // "Completed" = reached a terminal state — delivered or cancelled. Date
  // filter is on updated_at (the completion time this list is sorted by),
  // not created_at (when the order was first placed).
  let query = supabase
    .from("orders")
    .select("id, status, created_at, updated_at, sellers(store_name)")
    .in("status", ["delivered", "cancelled"])
    .order("updated_at", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE); // one extra row -> hasMore
  if (searchParams.from) query = query.gte("updated_at", istDayBounds(searchParams.from).startIso);
  if (searchParams.to) query = query.lte("updated_at", istDayBounds(searchParams.to).endIso);

  const { data: orders } = await query;

  const rows = (orders as unknown as OrderRow[]) ?? [];
  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const list = hasMore ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;
  const ids = list.map((o) => o.id);
  const { data: events } = ids.length
    ? await supabase
        .from("order_status_events")
        .select("order_id, status, created_at")
        .in("order_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };

  const eventsByOrder = new Map<string, StatusEvent[]>();
  for (const e of (events as (StatusEvent & { order_id: string })[]) ?? []) {
    (eventsByOrder.get(e.order_id) ?? eventsByOrder.set(e.order_id, []).get(e.order_id)!).push({
      status: e.status,
      created_at: e.created_at,
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Order lifecycle</h1>
      <p className="text-sm text-ink-soft">
        Completed orders (delivered or cancelled), with how long each stage took.
      </p>

      <HistoryFilters hasMore={hasMore} page={page} />

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">No completed orders yet.</div>
        ) : (
          list.map((o) => {
            const timeline = eventsByOrder.get(o.id) ?? [];
            const total = timeline.length >= 2 ? durationLabel(timeline[0].created_at, timeline[timeline.length - 1].created_at) : "—";
            return (
              <div key={o.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm text-gray-500">#{o.id.slice(0, 8)}</span>
                    <span className="ml-2 text-sm font-semibold text-ink">{o.sellers?.store_name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge ${
                        o.status === "delivered" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                    <span className="text-xs font-semibold text-ink-soft">Total: {total}</span>
                  </div>
                </div>

                <ol className="mt-3 flex flex-wrap items-start gap-x-1 gap-y-2 text-xs">
                  {timeline.map((e, i) => (
                    <li key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-ink-faint">→</span>}
                      <span className="rounded-lg bg-gray-50 px-2 py-1">
                        <span className="font-semibold text-ink">{ORDER_STATUS_LABELS[e.status]}</span>
                        <span className="ml-1 text-ink-faint">{formatIST(e.created_at)}</span>
                        {i > 0 && (
                          <span className="ml-1 text-brand-600">
                            (+{durationLabel(timeline[i - 1].created_at, e.created_at)})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
