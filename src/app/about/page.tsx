import type { Metadata } from "next";
import { Zap, ShieldCheck, Leaf, HeartHandshake } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "GrabOn was built by an MCA student at Pondicherry University who spotted a gap — no quick-commerce on campus. Groceries and essentials delivered in minutes.",
};

const VALUES = [
  {
    icon: Zap,
    title: "Speed without compromise",
    body: "We believe waiting for groceries is a problem of the past. Our hyper-local network of sellers and riders is built to get essentials to your door in under 11 minutes.",
  },
  {
    icon: Leaf,
    title: "Farm-fresh quality",
    body: "Every product on GrabOn is sourced from trusted local sellers. Fresh fruits, vegetables, and daily staples — handpicked and quality-checked.",
  },
  {
    icon: ShieldCheck,
    title: "Safe & transparent",
    body: "Your data and your money are safe with us. We never sell your personal information and all transactions are secured end-to-end.",
  },
  {
    icon: HeartHandshake,
    title: "Supporting local",
    body: "GrabOn is a platform for neighbourhood sellers. Every order you place directly supports a local business owner in Agra.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-8">
      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-accent-500 px-6 py-10 text-center text-white">
          <span className="text-5xl">🛒</span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
            About GrabOn
          </h1>
          <p className="mt-2 text-base text-white/85">
            Agra&apos;s fastest grocery delivery — fresh essentials at your door
            in minutes.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm leading-relaxed text-ink-soft">
            GrabOn started with a very real problem. As an{" "}
            <strong className="text-ink">
              MCA student at Pondicherry University
            </strong>
            , I noticed something that every student on campus quietly lived
            with — there was no quick-commerce platform nearby. If you ran out
            of shampoo, needed a late-night snack, or forgot to buy something
            for an assignment, your only option was to step off campus and make
            the trip yourself.
          </p>
          <p className="text-sm leading-relaxed text-ink-soft">
            That gap frustrated me enough to build a solution. GrabOn is a
            hyper-local delivery platform designed so that students and busy
            people can order groceries and daily essentials and have them
            delivered in minutes — without ever leaving their room.
          </p>
          <p className="text-sm leading-relaxed text-ink-soft">
            What began as a campus-side project is now a full-featured platform
            connecting local sellers and riders to deliver essentials fast.
            Every line of code, every design decision, and every feature exists
            because a real person needed it.
          </p>
          {/* <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-3">
            <span className="text-2xl">👨‍💻</span>
            <div>
              <p className="text-xs font-bold text-ink">
                Built by a student, for everyone
              </p>
              <p className="text-xs text-ink-soft">
                MCA · Pondicherry University
              </p>
            </div>
          </div> */}
        </div>
      </div>

      {/* Values */}
      <div>
        <h2 className="mb-4 text-lg font-extrabold text-ink">
          What we stand for
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="card flex gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <v.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{v.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {v.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact CTA */}
      <div className="card p-5 text-center">
        <p className="text-sm text-ink-soft">
          Questions or feedback?{" "}
          <a
            href="mailto:tamasgupta02@gmail.com"
            className="font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            tamasgupta02@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
