import type { Metadata } from "next";
import { Clock, Mail, Package, CheckCircle, XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "GrabOn Refund and Cancellation Policy — how to request a refund and what to expect.",
};

const LAST_UPDATED = "23 July 2025";

const STEPS = [
  {
    icon: Clock,
    step: "Step 1 — Within 24 hours",
    body: "You must raise your refund request within 24 hours of receiving your delivery. Requests made after this window will not be accepted.",
  },
  {
    icon: Mail,
    step: "Step 2 — Email us",
    body: "Send an email to tamasgupta@gmail.com with the subject line \"Refund Request — Order #[your order ID]\". In the email, describe the exact issue (e.g. wrong item, damaged product, missing quantity). Attach a photo of the product if possible.",
  },
  {
    icon: Package,
    step: "Step 3 — Return the product",
    body: "You must return the product in its original condition — exactly as it was received. Our rider or a pickup agent will collect it from your delivery address within 48 hours of your request being approved.",
  },
  {
    icon: CheckCircle,
    step: "Step 4 — Refund issued",
    body: "Once the returned item is verified, we will process your refund within 3–5 business days. Refunds are issued to your original payment method or as GrabOn wallet credit at our discretion.",
  },
];

const ELIGIBLE = [
  "Wrong product delivered",
  "Damaged, spoiled, or expired product",
  "Missing item from the order",
  "Significantly different quantity than ordered",
];

const NOT_ELIGIBLE = [
  "Product opened or partially consumed",
  "Request raised after 24 hours of delivery",
  "Change of mind after receiving the order",
  "Product returned in a condition different from how it was received",
  "Perishable items (e.g. fresh produce) where the issue is not verifiable",
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
          We want every GrabOn order to be perfect. If something is wrong, we
          will make it right — here is exactly how.
        </p>
      </div>

      {/* How to claim a refund */}
      <div>
        <h2 className="mb-4 text-lg font-extrabold text-ink">
          How to claim a refund
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
          You may cancel an order only <strong className="text-ink">before it is accepted by the seller</strong>. Once the seller confirms your order, cancellation is not possible. If you need assistance, email{" "}
          <a
            href="mailto:tamasgupta@gmail.com"
            className="font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            tamasgupta@gmail.com
          </a>{" "}
          immediately.
        </p>
      </div>

      {/* Contact */}
      <div className="card bg-brand-50 p-5 text-center">
        <p className="text-sm font-semibold text-ink">
          Questions about a refund?
        </p>
        <a
          href="mailto:tamasgupta@gmail.com"
          className="mt-1 block text-sm text-brand-600 underline-offset-2 hover:underline"
        >
          tamasgupta@gmail.com
        </a>
        <p className="mt-2 text-xs text-ink-faint">
          We typically respond within 4–6 business hours.
        </p>
      </div>
    </div>
  );
}
