"use client";

import { useState, useEffect } from "react";
import {
  Package, MapPin, Phone, Navigation, Check, Store, RefreshCw, IndianRupee, Clock, User as UserIcon, LogOut, Mail, ChevronDown, AlertTriangle, ChevronLeft, ChevronRight, Calendar, CreditCard, Banknote, QrCode, AlertCircle, CheckCircle, X, Maximize2,
} from "lucide-react";
import { Spinner } from "@/components/Loader";
import { inr } from "@/lib/utils";
import { notify } from "@/store/notify";
import type { RiderOrder } from "@/lib/rider";
import type { Tab } from "./RiderDashboard";

function RiderOrderCard({
  o,
  tab,
  busy,
  act,
}: {
  o: RiderOrder;
  tab: Tab;
  busy: boolean;
  act: (action: string, id: string, otp?: string, paymentMode?: "cash" | "upi") => Promise<{ ok: boolean; requirePayment?: boolean; remittanceDue?: number }>;
}) {
  const [otp, setOtp] = useState("");
  const [showItems, setShowItems] = useState(false);
  const [deliveryStep, setDeliveryStep] = useState<"otp" | "payment_mode" | "upi_qr" | "cash_complete">("otp");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | null>(null);
  const [upiData, setUpiData] = useState<{ orderId: string; amount: number; keyId: string } | null>(null);
  const [polling, setPolling] = useState(false);
  const [remittanceDue, setRemittanceDue] = useState(0);
  const [showQrModal, setShowQrModal] = useState(false);
  const itemCount = o.items.reduce((n, i) => n + i.qty, 0);
  const isCod = o.payment_status === "cod";

  // Reset delivery step when order changes
  useEffect(() => {
    setDeliveryStep("otp");
    setPaymentMode(null);
    setUpiData(null);
    setRemittanceDue(0);
  }, [o.id, o.status]);

  const startPayment = async (mode: "cash" | "upi") => {
    setPaymentMode(mode);
    if (mode === "upi") {
      setDeliveryStep("upi_qr");
      try {
        const res = await fetch("/api/rider/create-delivery-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: o.id, payment_mode: "upi" }),
        });
        const data = await res.json();
        if (data.razorpay_order_id) {
          setUpiData({
            orderId: data.razorpay_order_id,
            amount: data.amount,
            keyId: data.key_id,
          });
          // Fetch QR code image URL
          fetchUpiQr(data.razorpay_order_id, data.key_id);
          startPolling();
        }
      } catch (err) {
        console.error(err);
        notify.error("Failed to create UPI payment");
        setDeliveryStep("payment_mode");
      }
    } else {
      // Cash mode - complete delivery
      completeDelivery("cash");
    }
  };

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQrModal(false);
    };
    if (showQrModal) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showQrModal]);

  const fetchUpiQr = async (orderId: string, keyId: string) => {
    try {
      // Use Razorpay's UPI QR endpoint
      const res = await fetch(`/api/rider/upi-qr?order_id=${orderId}&key_id=${keyId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.qr_url) {
        setQrCodeUrl(data.qr_url);
        // Auto-open modal when QR is ready
        setShowQrModal(true);
      }
    } catch (err) {
      console.error("Failed to fetch QR:", err);
    }
  };

  const startPolling = () => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rider/delivery-payment-status?order_id=${o.id}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.delivery_payment_status === "paid") {
          clearInterval(interval);
          setPolling(false);
          completeDelivery("upi");
        } else if (data.delivery_payment_status === "failed") {
          clearInterval(interval);
          setPolling(false);
          notify.error("Payment failed");
          setDeliveryStep("payment_mode");
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);

    // Cleanup after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const completeDelivery = async (mode: "cash" | "upi") => {
    const result = await act("deliver", o.id, otp, mode);
    if (result.ok) {
      if (result.remittanceDue) {
        setRemittanceDue(result.remittanceDue);
        setDeliveryStep("cash_complete");
      }
    } else if (result.requirePayment) {
      setDeliveryStep("payment_mode");
    }
  };

  const handleDeliverClick = async () => {
    if (otp.length !== 4) return;
    if (isCod) {
      setDeliveryStep("payment_mode");
    } else {
      completeDelivery("upi");
    }
  };

  // Show payment status badge for history tab
  const getPaymentStatusBadge = () => {
    if (!isCod) return null;
    if (tab === "history") {
      if (o.payment_mode === "upi") {
        return <span className="badge bg-green-50 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Paid via UPI</span>;
      }
      if (o.payment_mode === "cash") {
        if (o.rider_remittance_status === "paid") {
          return <span className="badge bg-green-50 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Cash collected, remitted</span>;
        }
        if (o.rider_remittance_status === "pending") {
          return <span className="badge bg-amber-50 text-amber-700 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Cash collected, remit ₹{o.rider_remittance_due}</span>;
        }
        return <span className="badge bg-amber-50 text-amber-700 flex items-center gap-1"><Banknote className="h-3 w-3" /> Cash collected</span>;
      }
    }
    return <span className={`badge ${isCod ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-700"}`}>{isCod ? "Collect COD" : "Prepaid"}</span>;
  };

  // Directions helper (inline to avoid import issues)
  const directionsHref = (dest: { lat: number | null; lng: number | null } | null, textParts: (string | null)[]) => {
    if (dest?.lat != null && dest?.lng != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
    }
    const q = textParts.filter(Boolean).join(", ");
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  };

  return (
    <div className="card space-y-3 p-4">
      {/* Buyer info - visible in all tabs */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-ink-faint" />
          <span className="font-medium text-ink">{o.buyer_name}</span>
        </div>
        {o.buyer_phone && (
          <a href={`tel:${o.buyer_phone.replace(/^91/, "")}`} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
            <Phone className="h-3.5 w-3.5" />
            {o.buyer_phone}
          </a>
        )}
      </div>

      {/* Payment status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Store className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-ink">{o.store_name}</p>
            <p className="text-xs text-ink-faint">
              #{o.id.slice(0, 8)} · {itemCount} item{itemCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {getPaymentStatusBadge()}
          {tab === "available" && o.status !== "packed" && (
            <span className="badge flex items-center gap-1 bg-gray-100 text-gray-500">
              <Clock className="h-3 w-3" />
              {o.status === "placed" 
                ? "Order placed" 
                : o.status === "accepted"
                  ? "Store accepted"
                  : o.status === "action_required"
                    ? "Waiting for buyer (stock issue)"
                    : "Store is preparing"}
            </span>
          )}
        </div>
      </div>

      {/* Earnings + total */}
      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
        <span className="flex items-center gap-1 font-semibold text-brand-700">
          <IndianRupee className="h-3.5 w-3.5" /> {inr(o.delivery_fee)} earning
        </span>
        <span className="text-ink-soft">
          Order {inr(o.total)}
          {isCod && <span className="font-semibold text-ink"> · collect {inr(o.total)}</span>}
        </span>
      </div>

      {/* Pickup leg */}
      {tab === "active" && o.status === "packed" && o.store && (
        <div className="space-y-2 rounded-xl border border-gray-100 p-3">
          <div className="flex items-start gap-2">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            <div className="text-sm">
              <p className="font-semibold text-ink">{o.store_name}</p>
              <p className="text-ink-soft">
                {[o.store.address_line, o.store.city, o.store.pincode].filter(Boolean).join(", ") || "Address not pinned"}
              </p>
            </div>
          </div>
          <a
            href={directionsHref(o.store, [o.store.address_line, o.store.city, o.store.pincode])}
            target="_blank"
            rel="noreferrer"
            className="btn-outline w-full"
          >
            <Navigation className="h-4 w-4" /> Navigate to store
          </a>
        </div>
      )}

      {/* Delivery leg */}
      {tab === "active" && o.status === "out_for_delivery" && o.address && (
        <div className="space-y-2 rounded-xl border border-gray-100 p-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            <div className="text-sm">
              <p className="font-semibold text-ink">{o.buyer_name}</p>
              <p className="text-ink-soft">
                {[o.address.line1, o.address.line2, o.address.city, o.address.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {o.address.lat != null && (
                <p className="text-[11px] text-brand-600">Exact GPS location pinned</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={directionsHref(o.address, [o.address.line1, o.address.line2, o.address.city, o.address.pincode])}
              target="_blank"
              rel="noreferrer"
              className="btn-outline flex-1"
            >
              <Navigation className="h-4 w-4" /> Navigate to customer
            </a>
            {o.buyer_phone && (
              <a href={`tel:${o.buyer_phone.replace(/^91/, "")}`} className="btn-outline flex-1">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
          </div>
        </div>
      )}

      {/* Items - expandable list */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowItems(!showItems)}
          className="flex items-center justify-between w-full text-left text-xs text-ink-faint hover:text-ink"
        >
          <span>
            {o.items.slice(0, 3).map((i) => `${i.name}×${i.qty}`).join(", ")}
            {o.items.length > 3 ? ` +${o.items.length - 3} more` : ""}
          </span>
          <span className="flex items-center gap-1 font-medium">
            {itemCount} item{itemCount === 1 ? "" : "s"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showItems ? "rotate-180" : ""}`} />
          </span>
        </button>

        {showItems && (
          <ul className="space-y-1 border-t pt-2">
            {o.items.map((it) => (
              <li key={it.id} className="flex justify-between text-sm">
                <span>{it.name} × {it.qty}</span>
                <span className="font-medium">{inr((o.total / itemCount) * it.qty)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      {tab === "available" && (
        o.status === "packed" ? (
          <button
            onClick={() => act("claim", o.id)}
            disabled={busy}
            className="btn-primary w-full"
          >
            {busy ? <Spinner /> : <Check className="h-4 w-4" />} Accept delivery
          </button>
        ) : o.status === "action_required" ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 py-2.5 text-sm font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Waiting for buyer to respond to stock issue
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 py-2.5 text-sm font-medium text-ink-faint">
            <Clock className="h-4 w-4" /> Not ready yet — waiting for the store to pack it
          </div>
        )
      )}

      {tab === "active" && o.status === "packed" && (
        <button
          onClick={() => act("pickup", o.id)}
          disabled={busy}
          className="btn-primary w-full"
        >
          {busy ? <Spinner /> : <Package className="h-4 w-4" />} Mark picked up
        </button>
      )}

      {/* Delivery flow for out_for_delivery */}
      {tab === "active" && o.status === "out_for_delivery" && (
        <div className="space-y-3">
          {/* Step 1: OTP Entry */}
          {deliveryStep === "otp" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 4-digit OTP"
                  className="input text-center tracking-[0.3em] flex-1"
                />
                <button
                  onClick={handleDeliverClick}
                  disabled={busy || otp.length !== 4}
                  className="btn-primary shrink-0"
                >
                  {busy ? <Spinner /> : <Check className="h-4 w-4" />} Verify OTP
                </button>
              </div>
              <p className="text-[11px] text-ink-faint">Ask the customer for their delivery OTP.</p>
            </div>
          )}

          {/* Step 2: Payment Mode Selection (COD only) */}
          {deliveryStep === "payment_mode" && isCod && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Select payment mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startPayment("upi")}
                  disabled={busy}
                  className="btn-outline flex flex-col items-center gap-2 py-3"
                >
                  <QrCode className="h-6 w-6" />
                  <span className="font-medium">UPI QR</span>
                  <span className="text-xs text-ink-faint">Buyer scans to pay</span>
                </button>
                <button
                  onClick={() => startPayment("cash")}
                  disabled={busy}
                  className="btn-outline flex flex-col items-center gap-2 py-3"
                >
                  <Banknote className="h-6 w-6" />
                  <span className="font-medium">Cash</span>
                  <span className="text-xs text-ink-faint">Collect cash from buyer</span>
                </button>
              </div>
              <button
                onClick={() => setDeliveryStep("otp")}
                className="text-xs text-brand-600 underline"
              >
                ← Back to OTP
              </button>
            </div>
          )}

          {/* Step 3: UPI QR Code Display */}
          {deliveryStep === "upi_qr" && upiData && (
            <div className="space-y-3 rounded-xl border border-gray-100 p-4 bg-white">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <QrCode className="h-5 w-5 text-brand-600" />
                  <span className="font-semibold text-ink">Scan to Pay</span>
                </div>
                <p className="text-sm text-ink-faint">Ask the buyer to scan this QR code with any UPI app</p>
                <p className="text-lg font-bold text-brand-700 mt-1">{inr(upiData.amount / 100)}</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="UPI QR Code"
                    className="w-48 h-48 rounded-lg border border-gray-200 cursor-zoom-in hover:opacity-80 transition-opacity"
                    onClick={() => setShowQrModal(true)}
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-50 rounded-lg flex items-center justify-center text-ink-faint">
                    Generating QR...
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-ink-faint">Auto-opened fullscreen · Tap QR to reopen · Waiting for buyer to complete payment...</p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => { setDeliveryStep("payment_mode"); setUpiData(null); setQrCodeUrl(null); }}
                  disabled={busy}
                  className="btn-outline text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Cash Complete - Show Remittance Due */}
          {deliveryStep === "cash_complete" && remittanceDue > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Cash collected — Remittance due</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-amber-700 font-bold">{inr(remittanceDue)}</p>
                  <p className="text-xs text-amber-600">Total to remit</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-700 font-bold">{inr(o.subtotal)}</p>
                  <p className="text-xs text-amber-600">Subtotal</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-700 font-bold">{inr(o.other_charges)}</p>
                  <p className="text-xs text-amber-600">Platform fee</p>
                </div>
              </div>
              <p className="text-xs text-amber-600">
                You kept ₹{o.delivery_fee} as delivery fee. Pay {inr(remittanceDue)} to platform via QR in Earnings tab.
              </p>
            </div>
          )}

          {/* Non-COD delivery completion */}
          {deliveryStep === "otp" && !isCod && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 4-digit OTP"
                  className="input text-center tracking-[0.3em] flex-1"
                />
                <button
                  onClick={handleDeliverClick}
                  disabled={busy || otp.length !== 4}
                  className="btn-primary shrink-0"
                >
                  {busy ? <Spinner /> : <Check className="h-4 w-4" />} Deliver
                </button>
              </div>
              <p className="text-[11px] text-ink-faint">Ask the customer for their delivery OTP.</p>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <p className="flex items-center gap-1 text-sm font-semibold text-brand-700">
          <Check className="h-4 w-4" /> Delivered
        </p>
      )}

      {/* QR Code Modal */}
      {showQrModal && qrCodeUrl && upiData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowQrModal(false)} role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 id="qr-modal-title" className="text-lg font-semibold text-ink">Scan to Pay</h2>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-ink-faint transition-colors"
                aria-label="Close QR code"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="text-center mb-4">
              <p className="text-sm text-ink-faint mb-1">Ask the buyer to scan with any UPI app</p>
              <p className="text-3xl font-bold text-brand-700">{inr(upiData.amount / 100)}</p>
            </div>
            
            <div className="flex justify-center mb-4">
              <img
                src={qrCodeUrl}
                alt="UPI QR Code for payment"
                className="w-72 h-72 rounded-lg border border-gray-200"
              />
            </div>
            
            <div className="rounded-lg bg-gray-50 p-3 text-center text-xs text-ink-faint">
              Order: #{upiData.orderId.slice(0, 8)}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { RiderOrderCard };