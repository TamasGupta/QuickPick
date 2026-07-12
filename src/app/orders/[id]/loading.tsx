import { SkelLine, SkelCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <SkelLine className="h-6 w-40" />
        <SkelLine className="h-5 w-20 rounded-full" />
      </div>
      <SkelCard className="h-24" />
      <SkelCard className="h-40" />
      <SkelCard className="h-28" />
      <SkelCard className="h-32" />
    </div>
  );
}
