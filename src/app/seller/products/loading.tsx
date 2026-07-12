import { SellerNav } from "@/components/SellerNav";
import { SkelLine, SkelRow } from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <SellerNav />
      <div className="mb-4 flex items-center justify-between">
        <SkelLine className="h-6 w-32" />
        <SkelLine className="h-9 w-28 rounded-xl" />
      </div>
      <div className="card divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkelRow key={i} withAvatar />
        ))}
      </div>
    </div>
  );
}
