import { SellerNav } from "@/components/SellerNav";
import { SkelLine, SkelOrderList } from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <SellerNav />
      <SkelLine className="mb-4 h-6 w-44" />
      <SkelOrderList count={3} />
    </div>
  );
}
