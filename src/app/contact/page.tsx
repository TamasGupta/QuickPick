import type { Metadata } from "next";
import { Mail, MapPin, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with GrabOn — for support, refunds, partnerships or any other query.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Contact Us</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          We&apos;re a small team and we read every message. Reach out for order
          issues, refunds, feedback, or partnership enquiries.
        </p>
      </div>

      {/* Email card */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Mail className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">Email support</p>
            <p className="mt-1 text-xs text-ink-soft">
              For order issues, refunds or general enquiries.
            </p>
            <a
              href="mailto:tamasgupta@gmail.com?subject=GrabOn%20Support"
              className="btn-primary mt-4 inline-flex w-full justify-center"
            >
              <Mail className="h-4 w-4" />
              Send us an email
            </a>
            <p className="mt-2 text-center text-xs text-ink-faint">
              tamasgupta@gmail.com
            </p>
          </div>
        </div>
      </div>

      {/* Response time */}
      <div className="card flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">Response time</p>
          <p className="text-xs text-ink-soft">
            We typically reply within <strong className="text-ink">4–6 business hours</strong>{" "}
            on weekdays. For urgent refund requests please mention your order ID
            in the subject line.
          </p>
        </div>
      </div>

      {/* Location */}
      <div className="card flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <MapPin className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">Our location</p>
          <p className="text-xs text-ink-soft">
            Agra, Uttar Pradesh, India
          </p>
        </div>
      </div>

      {/* Refund shortcut */}
      <div className="card bg-brand-50 p-5">
        <p className="text-xs text-ink-soft">
          Looking for our refund process?{" "}
          <a
            href="/refund-policy"
            className="font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            Read the Refund &amp; Cancellation Policy →
          </a>
        </p>
      </div>
    </div>
  );
}
