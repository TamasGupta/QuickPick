export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

// Always renders in Indian Standard Time regardless of server/browser
// timezone (Vercel's serverless runtime defaults to UTC, which would
// otherwise show times 5:30 off for Indian users).
export function formatIST(date: string | Date): string {
  return new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const DELIVERY_FEE = Number(process.env.NEXT_PUBLIC_DELIVERY_FEE ?? 25);
export const MIN_ORDER = Number(process.env.NEXT_PUBLIC_MIN_ORDER ?? 99);

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: "Order Placed",
  accepted: "Accepted",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
