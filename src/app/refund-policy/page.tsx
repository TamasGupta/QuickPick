import type { Metadata } from "next";
import { Clock, ShieldAlert, PackageCheck, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "GrabOn Refund and Cancellation Policy — rules on order cancellations, doorstep inspection, and refunds.",
};

const LAST_UPDATED = "18 October 2026";

const STEPS = [
  {
    icon: Clock,
    step: "Step 1 — Cancellation window (before packed)",
    body: "You can cancel your order at any time before the order status is updated to \"Packed\". Once the store marks your order as \"Packed\", preparation is finalized and cancellation is no longer possible.",
  },
  {
    icon: PackageCheck,
    step: "Step 2 — Doorstep inspection",
    body: "When the delivery partner arrives, inspect all items in your order at your doorstep before accepting the delivery and sharing the delivery OTP.",
  },
  {
    icon: ShieldAlert,
    step: "Step 3 — Refuse wrong or damaged items at delivery",
    body: "If any item is incorrect, damaged, spoiled, or missing, you must refuse the order or the item at the time of delivery directly with the delivery partner. Refusals are accepted only at the doorstep during handover.",
  },
  {
    icon: CheckCircle,
    step: "Step 4 — Refund issued",
    body: "For eligible cancellations made before packing or items refused at the doorstep on prepaid orders, your refund will be processed to your original payment method within 3–5 business days. For Cash on Delivery orders, you only pay for what you accept.",
  },
];

const ELIGIBLE = [
  "Order cancelled by the buyer before status becomes 'Packed'",
  "Wrong or incorrect product refused at the time of delivery",
  "Damaged, spoiled, or expired product refused at the doorstep",
  "Missing items verified and reported to the delivery partner before acceptance",
  "Order cancelled by the store due to stock unavailability",
];

const NOT_ELIGIBLE = [
  "Any refund or return request raised after the order is accepted and marked as 'Delivered'",
  "Issues reported after the delivery partner departs and the delivery OTP is shared",
  "Cancellations requested once the order status becomes 'Packed', 'Out for Delivery', or 'Delivered'",
  "Products opened, unsealed, or partially consumed after delivery acceptance",
  "Change of mind after the order has been packed or delivered",
];

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-ink">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="mt-1 text-xs text-ink-faint">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          We want your GrabOn experience to be fast, clear, and dependable.
          Please read our policy on order cancellations, doorstep verification,
          and refunds below.
        </p>
      </div>

      {/* Critical Policy Banner */}
      <div className="card border-2 border-amber-300 bg-amber-50/70 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">
              Important: Doorstep Verification Only
            </p>
            <p className="mt-1 leading-relaxed text-amber-800">
              Please inspect all items before accepting your delivery. If an order or item is wrong, you must{" "}
              <strong>refuse it at the time of delivery only</strong>.{" "}
              <strong>
                No refund will be provided once the buyer accepts the order and the order is marked Delivered.
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* How cancellations & refunds work */}
      <div>
        <h2 className="mb-4 text-lg font-extrabold text-ink">
          How cancellations &amp; refunds work
        </h2>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <div key={s.step} className="card flex gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{s.step}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Eligible / Not eligible */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-700">
            <CheckCircle className="h-4 w-4" /> Eligible for refund
          </h2>
          <ul className="space-y-2">
            {ELIGIBLE.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs text-ink-soft"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-600">
            <XCircle className="h-4 w-4" /> Not eligible for refund
          </h2>
          <ul className="space-y-2">
            {NOT_ELIGIBLE.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs text-ink-soft"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Cancellations */}
      <div className="card p-5">
        <h2 className="mb-2 text-sm font-bold text-ink">
          Order cancellations
        </h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Buyers can cancel an order only{" "}
          <strong className="text-ink">before the order status becomes &quot;Packed&quot;</strong>.
          Once the store packs your items, packaging is completed and cancellation is no longer possible.
          For prepaid orders cancelled before packing, a full refund will be automatically initiated to your original payment method.
        </p>
      </div>

      {/* Doorstep Inspection & Delivery Acceptance Details */}
      <div className="card p-5">
        <h2 className="mb-2 text-sm font-bold text-ink">
          Doorstep inspection &amp; refusal policy
        </h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Due to the nature of quick grocery delivery and perishables:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-ink-soft leading-relaxed">
          <li>
            <strong className="text-ink">Inspect upon handover:</strong> You must check the contents of your order with the delivery partner before providing the OTP.
          </li>
          <li>
            <strong className="text-ink">Refusal at delivery only:</strong> If an item is incorrect, expired, or damaged, you must refuse it at the time of delivery directly with the delivery partner.
          </li>
          <li>
            <strong className="text-ink">No refund after delivery:</strong> No refund will be provided once the buyer accepts the order and the order is marked Delivered. Claims cannot be made after the delivery partner departs.
          </li>
        </ul>
      </div>

      {/* Contact */}
      <div className="card bg-brand-50 p-5 text-center">
        <p className="text-sm font-semibold text-ink">
          Questions about our policy?
        </p>
        <a
          href="mailto:tamasgupta02@gmail.com"
          className="mt-1 block text-sm text-brand-600 underline-offset-2 hover:underline"
        >
          tamasgupta02@gmail.com
        </a>
        <p className="mt-2 text-xs text-ink-faint">
          We typically respond within 4–6 business hours.
        </p>
      </div>
    </div>
  );
}
