"use client";

import { usePathname } from "next/navigation";

// Fades each new page in on navigation instead of an abrupt hard-cut swap.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
