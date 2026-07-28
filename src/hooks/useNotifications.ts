// "use client";
//
// Unused — both former consumers now compute their own badge counts via
// Realtime subscriptions instead of polling /api/notifications:
//   BottomNav  -> useBuyerActiveCount (see BottomNav.tsx)
//   SellerNav  -> useSellerNewCount (see SellerNav.tsx)
// Left commented rather than deleted in case a future badge genuinely needs
// a simple polled count again.
//
// import { useEffect, useState } from "react";
//
// export interface Notifications {
//   buyerActive: number;
//   sellerNew: number;
//   riderAvailable: number;
// }
//
// const EMPTY: Notifications = { buyerActive: 0, sellerNew: 0, riderAvailable: 0 };
//
// export function useNotifications(intervalMs = 20000): Notifications {
//   const [counts, setCounts] = useState<Notifications>(EMPTY);
//
//   useEffect(() => {
//     let alive = true;
//     async function load() {
//       try {
//         const res = await fetch("/api/notifications", { cache: "no-store" });
//         if (!res.ok) return;
//         const json = (await res.json()) as Notifications;
//         if (alive) setCounts(json);
//       } catch {
//         /* ignore transient failures */
//       }
//     }
//     load();
//     const id = setInterval(load, intervalMs);
//     return () => {
//       alive = false;
//       clearInterval(id);
//     };
//   }, [intervalMs]);
//
//   return counts;
// }
