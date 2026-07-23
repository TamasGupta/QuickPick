import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "GrabOn Privacy Policy — how we collect, use, and protect your personal data.",
};

const LAST_UPDATED = "23 July 2025";

const SECTIONS = [
  {
    title: "1. Who we are",
    body: `GrabOn ("we", "us", "our") is a grocery delivery platform operated from Agra, Uttar Pradesh, India. Our contact email is tamasgupta@gmail.com.`,
  },
  {
    title: "2. Information we collect",
    body: `We collect the following information when you use GrabOn:\n\n• **Phone number** — used for login and delivery communication.\n• **Full name** — optional, used to personalise your experience.\n• **Delivery address** — required to fulfil your orders.\n• **Order history** — to display past purchases and handle refunds.\n• **Device & usage data** — anonymised analytics to improve the app (e.g. page visits, crash reports via Sentry). No personally identifiable information is included in these reports.`,
  },
  {
    title: "3. How we use your information",
    body: `We use your data solely to:\n\n• Process and deliver your orders.\n• Send order status notifications (via the app).\n• Improve app performance and fix bugs.\n• Respond to support and refund requests.\n\nWe do NOT sell, rent, or share your personal data with third-party advertisers.`,
  },
  {
    title: "4. Data sharing",
    body: `Your data is shared only with the following parties:\n\n• **Sellers on GrabOn** — only the information needed to fulfil your order (name, address, phone) is visible to the seller handling your order.\n• **Delivery riders** — your delivery address and name are shared with the assigned rider.\n• **Supabase (database provider)** — our data is stored securely on Supabase infrastructure hosted in data centres that comply with industry-standard security practices.\n• **Sentry (error monitoring)** — anonymised crash data only.`,
  },
  {
    title: "5. Data retention",
    body: `We retain your account data for as long as your account is active. You may request deletion of your account and associated data at any time by emailing tamasgupta@gmail.com. We will process the request within 30 days.`,
  },
  {
    title: "6. Cookies & local storage",
    body: `GrabOn stores your authentication session in browser cookies (set by Supabase) and your cart state in browser local storage. These are essential for the app to function and cannot be disabled. We do not use third-party tracking or advertising cookies.`,
  },
  {
    title: "7. Children's privacy",
    body: `GrabOn is not intended for children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us at tamasgupta@gmail.com.`,
  },
  {
    title: "8. Your rights",
    body: `Under India's Digital Personal Data Protection Act (DPDP Act, 2023), you have the right to:\n\n• Access the personal data we hold about you.\n• Correct inaccurate data.\n• Request deletion of your data.\n• Withdraw consent at any time.\n\nTo exercise any of these rights, email us at tamasgupta@gmail.com.`,
  },
  {
    title: "9. Security",
    body: `We use industry-standard security measures including HTTPS encryption for all data in transit and row-level security policies on our database. However, no system is 100% secure and we cannot guarantee absolute security.`,
  },
  {
    title: "10. Changes to this policy",
    body: `We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page will reflect any changes. Continued use of GrabOn after an update constitutes acceptance of the revised policy.`,
  },
  {
    title: "11. Contact us",
    body: `For any privacy-related queries, please contact:\n\n**GrabOn**\nAgra, Uttar Pradesh, India\nEmail: tamasgupta@gmail.com`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Privacy Policy</h1>
        <p className="mt-1 text-xs text-ink-faint">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          This Privacy Policy explains how GrabOn collects, uses, stores, and
          protects your personal data when you use our app and website. Please
          read it carefully.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <div key={s.title} className="card p-5">
            <h2 className="mb-2 text-sm font-bold text-ink">{s.title}</h2>
            <div className="space-y-2">
              {s.body.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  className="text-sm leading-relaxed text-ink-soft whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: para.replace(/\*\*(.*?)\*\*/g, "<strong class='text-ink'>$1</strong>"),
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
