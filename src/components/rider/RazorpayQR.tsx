"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface RazorpayQRProps {
  razorpayOrderId: string;
  amount: number;
  keyId: string;
  onPaymentSuccess: (paymentId: string) => void;
  onPaymentFailed: () => void;
}

export function RazorpayQR({
  razorpayOrderId,
  amount,
  keyId,
  onPaymentSuccess,
  onPaymentFailed,
}: RazorpayQRProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || loaded) return;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !containerRef.current || !window.Razorpay) return;

    const options = {
      key: keyId,
      order_id: razorpayOrderId,
      amount: amount,
      currency: "INR",
      name: "QuickPick Delivery",
      description: `Payment for delivery`,
      image: "/logo.png",
      handler: function (response: { razorpay_payment_id: string }) {
        onPaymentSuccess(response.razorpay_payment_id);
      },
      modal: {
        ondismiss: function () {
          onPaymentFailed();
        },
      },
      theme: {
        color: "#7C3AED",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();

    return () => {
      rzp.close();
    };
  }, [loaded, razorpayOrderId, amount, keyId, onPaymentSuccess, onPaymentFailed]);

  return <div ref={containerRef} className="hidden" />;
}