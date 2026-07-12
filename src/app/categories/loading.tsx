import { SkelLine } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkelLine className="h-6 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-[4/3] shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
