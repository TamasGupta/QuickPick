import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm your delivery address and place your GrabOn order.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
