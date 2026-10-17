import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "GrabOn Terms and Conditions — your rights and obligations when using our grocery delivery platform.",
};

const LAST_UPDATED = "23 July 2025";

const SECTIONS = [
  {
    title: "1. Acceptance of terms",
    body: `By accessing or using the GrabOn app or website, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our platform.`,
  },
  {
    title: "2. Eligibility",
    body: `You must be at least 18 years of age (or have the consent of a parent or guardian) to use GrabOn. By using the platform, you confirm that you meet this requirement.`,
  },
  {
    title: "3. Account registration",
    body: `To place orders you must create an account using your phone number. You are responsible for maintaining the confidentiality of your account and for all activities that occur under it. Notify us immediately at tamasgupta02@gmail.com if you suspect unauthorised access to your account.`,
  },
  {
    title: "4. Orders & payment",
    body: `• All prices displayed on GrabOn are inclusive of applicable taxes.\n• Orders are subject to product availability. If an item becomes unavailable after your order is placed, we will notify you and offer a refund for that item.\n• Payments are processed at the time of checkout. Currently we support Cash on Delivery and online payment options as shown in the app.\n• GrabOn reserves the right to cancel any order that appears fraudulent or violates these terms.`,
  },
  {
    title: "5. Delivery",
    body: `• Delivery timings are estimates only. While we aim for delivery in under 11 minutes, actual delivery times may vary based on distance, traffic, and seller preparation time.\n• Delivery is currently available within serviceable areas in Agra, Uttar Pradesh only.\n• You must ensure that someone is available at the delivery address to receive the order. If the order cannot be delivered due to the customer's unavailability, it will be returned and a refund issued as per our Refund Policy.`,
  },
  {
    title: "6. Prohibited conduct",
    body: `You agree NOT to:\n\n• Provide false information during registration or checkout.\n• Place orders with no intention of receiving them.\n• Abuse, threaten, or harass GrabOn staff, sellers, or riders.\n• Attempt to reverse-engineer, scrape, or disrupt the platform.\n• Use GrabOn for any unlawful purpose.`,
  },
  {
    title: "7. Intellectual property",
    body: `All content on GrabOn — including the logo, app design, product images, and written content — is the property of GrabOn or its licensors. You may not copy, reproduce, or distribute any content without prior written consent.`,
  },
  {
    title: "8. Limitation of liability",
    body: `GrabOn provides its platform on an "as is" basis. To the fullest extent permitted by law, GrabOn is not liable for:\n\n• Any indirect, incidental, or consequential damages.\n• Loss arising from the quality of products sold by third-party sellers.\n• Service interruptions due to technical failures or force majeure events.`,
  },
  {
    title: "9. Seller responsibility",
    body: `GrabOn is a marketplace platform. Sellers are independent businesses responsible for the quality, safety, and accuracy of the products they list. GrabOn makes reasonable efforts to ensure quality but does not directly manufacture or inspect every product.`,
  },
  {
    title: "10. Governing law",
    body: `These Terms & Conditions are governed by the laws of India. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts of Agra, Uttar Pradesh.`,
  },
  {
    title: "11. Changes to terms",
    body: `We may update these Terms from time to time. Continued use of GrabOn after changes are posted constitutes your acceptance of the updated terms. The "Last updated" date at the top of this page reflects the most recent revision.`,
  },
  {
    title: "12. Contact",
    body: `For any questions regarding these Terms, contact us at:\n\n**GrabOn**\nAgra, Uttar Pradesh, India\nEmail: tamasgupta02@gmail.com`,
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-ink">
          Terms &amp; Conditions
        </h1>
        <p className="mt-1 text-xs text-ink-faint">
          Last updated: {LAST_UPDATED}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Please read these Terms &amp; Conditions carefully before using
          GrabOn. By using our platform you agree to these terms.
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
                    __html: para.replace(
                      /\*\*(.*?)\*\*/g,
                      "<strong class='text-ink'>$1</strong>",
                    ),
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
