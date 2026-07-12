import { SkelLine, SkelOrderList } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SkelLine className="h-6 w-32" />
      <SkelOrderList count={4} />
    </div>
  );
}
