// Shimmering placeholder card shown while products load.
export function ProductSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-2 shadow-card">
      <div className="mb-2 aspect-square rounded-xl shimmer" />
      <div className="mb-1 h-3 w-14 rounded shimmer" />
      <div className="mb-1.5 h-3.5 w-full rounded shimmer" />
      <div className="mb-3 h-3 w-2/3 rounded shimmer" />
      <div className="mt-auto flex items-center justify-between">
        <div className="h-4 w-12 rounded shimmer" />
        <div className="h-7 w-14 rounded-lg shimmer" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
}
