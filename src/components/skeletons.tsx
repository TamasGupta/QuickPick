// Shared shimmer building blocks for route-level loading.tsx skeletons.
// Shapes roughly match the real content so there's no layout jump when data arrives.

export function SkelLine({ className = "" }: { className?: string }) {
  return <div className={`rounded shimmer ${className}`} />;
}

export function SkelCard({ className = "" }: { className?: string }) {
  return <div className={`card shimmer ${className}`} />;
}

export function SkelStatGrid({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid gap-3 ${cols === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="card p-4">
          <SkelLine className="mb-2 h-3 w-14" />
          <SkelLine className="h-5 w-10" />
        </div>
      ))}
    </div>
  );
}

export function SkelRow({ withAvatar = false }: { withAvatar?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3">
      {withAvatar && <SkelLine className="h-10 w-10 shrink-0 rounded-xl" />}
      <div className="flex-1 space-y-2">
        <SkelLine className="h-3.5 w-2/3" />
        <SkelLine className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function SkelOrderCard() {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <SkelLine className="h-3.5 w-24" />
        <SkelLine className="h-5 w-16 rounded-full" />
      </div>
      <SkelLine className="h-3 w-1/2" />
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <SkelLine className="h-4 w-16" />
        <SkelLine className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function SkelOrderList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkelOrderCard key={i} />
      ))}
    </div>
  );
}
