"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const FILES = {
  "delivery-rider": "/icons/delivery-rider.lottie",
  "cart-check": "/icons/cart-check.lottie",
  "order-delivered": "/icons/order-delivered.lottie",
} as const;

export type LottieName = keyof typeof FILES;

export function LottieIcon({
  name,
  loop = true,
  autoplay = true,
  className,
}: {
  name: LottieName;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}) {
  return (
    <DotLottieReact
      src={FILES[name]}
      loop={loop}
      autoplay={autoplay}
      className={className}
    />
  );
}
