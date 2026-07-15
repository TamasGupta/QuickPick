"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, ShieldCheck, ArrowLeft, User as UserIcon, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

// TEMPORARY: while the SMS provider isn't delivering, everyone logs in with
// one shared static code (set server-side via STATIC_OTP_CODE) instead of a
// real per-user OTP. Turn this off (unset the env vars, redeploy) the moment
// real SMS delivery works — see /api/auth/static-login for the security note.
const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_OTP_ENABLED === "true";

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === "otp") otpRef.current?.focus();
  }, [step]);

  function e164() {
    return `+91${phone}`;
  }

  // Sellers/riders/admins always land on their own dashboard, regardless of
  // `next` — that param is only meaningful for buyer flows (e.g. checkout).
  function destinationFor(role: string | undefined) {
    if (role === "admin") return "/admin";
    if (role === "seller") return "/seller";
    if (role === "rider") return "/rider";
    return next;
  }

  // Shared by both the real-OTP and static-OTP paths once a session exists.
  async function afterVerified(userId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .single();
    setLoading(false);
    if (!profile?.full_name) {
      setStep("name");
      return;
    }
    router.push(destinationFor(profile.role));
    router.refresh();
  }

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (STATIC_MODE) {
      // No real SMS goes out in static mode — just move to the code step.
      setStep("otp");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164() });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("otp");
    setResendIn(RESEND_SECONDS);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);

    if (STATIC_MODE) {
      const res = await fetch("/api/auth/static-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164(), code: otp }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(json.error ?? "Login failed");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setError("Login failed — please try again.");
        return;
      }
      await afterVerified(user.id);
      return;
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone: e164(),
      token: otp,
      type: "sms",
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    await afterVerified(data.user!.id);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
    }
    setLoading(false);
    // Reaching this step means the account had no name yet, which only
    // happens for a brand-new buyer signup — always safe to use `next`.
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      {STATIC_MODE && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-700">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          Static OTP mode — SMS delivery is temporarily disabled for testing.
        </div>
      )}
      <div className="card animate-fade-in p-6">
        {step === "phone" && (
          <>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Phone className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold text-ink">Login or sign up</h1>
            <p className="mt-1 text-sm text-ink-faint">
              {STATIC_MODE ? "Enter your mobile number to continue." : "We'll text you a one-time code."}
            </p>

            <form onSubmit={sendOtp} className="mt-4 space-y-3">
              <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                <span className="flex items-center bg-gray-50 px-3 text-sm font-semibold text-ink-soft">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  required
                  placeholder="98765 43210"
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Sending…" : STATIC_MODE ? "Continue" : "Send OTP"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <button
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
              className="mb-2 flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Change number
            </button>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold text-ink">Verify your number</h1>
            <p className="mt-1 text-sm text-ink-faint">
              {STATIC_MODE
                ? "Enter the shared testing code."
                : `Enter the 6-digit code sent to +91 ${phone}`}
            </p>

            <form onSubmit={verifyOtp} className="mt-4 space-y-3">
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="••••••"
                className="input text-center text-lg tracking-[0.5em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Verifying…" : "Verify & continue"}
              </button>
              {!STATIC_MODE && (
                <button
                  type="button"
                  onClick={() => sendOtp()}
                  disabled={resendIn > 0 || loading}
                  className="w-full text-center text-sm text-brand-700 disabled:text-ink-faint"
                >
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                </button>
              )}
            </form>
          </>
        )}

        {step === "name" && (
          <>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <UserIcon className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold text-ink">What should we call you?</h1>
            <p className="mt-1 text-sm text-ink-faint">This helps sellers and delivery partners identify you.</p>

            <form onSubmit={saveName} className="mt-4 space-y-3">
              <input
                autoFocus
                required
                placeholder="Your name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Saving…" : "Continue"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
