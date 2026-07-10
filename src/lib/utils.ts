export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
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
