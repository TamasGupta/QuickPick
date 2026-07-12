import { SkelLine, SkelStatGrid, SkelRow } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkelLine className="h-6 w-40" />
      <SkelStatGrid cols={4} />
      <div>
        <SkelLine className="mb-2 h-4 w-20" />
        <div className="card divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
